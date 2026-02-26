import { query } from '../db';
import { Contact, IdentifyRequest, IdentifyResponse } from '../types';

export class IdentityService {
  async identify(request: IdentifyRequest): Promise<IdentifyResponse> {
    const { email, phoneNumber } = request;

    if (!email && !phoneNumber) {
      throw new Error('Either email or phoneNumber must be provided');
    }

    // Find all matching contacts
    const contacts = await this.findMatchingContacts(email, phoneNumber);

    if (contacts.length === 0) {
      // No existing contact - create new primary
      const newContact = await this.createContact(email, phoneNumber, null, 'primary');
      return this.buildResponse([newContact]);
    }

    // Get all primary contacts from the matches
    const primaryContacts = this.getPrimaryContacts(contacts);

    if (primaryContacts.length > 1) {
      // Multiple primaries found - need to merge
      await this.mergePrimaryContacts(primaryContacts);
      const allContacts = await this.findMatchingContacts(email, phoneNumber);
      return this.buildResponse(allContacts);
    }

    const primaryContact = primaryContacts[0];
    
    // Check if we need to create a new secondary contact
    const needsNewSecondary = this.needsNewSecondaryContact(contacts, email, phoneNumber);
    
    if (needsNewSecondary) {
      await this.createContact(email, phoneNumber, primaryContact.id, 'secondary');
      const updatedContacts = await this.findMatchingContacts(email, phoneNumber);
      return this.buildResponse(updatedContacts);
    }

    return this.buildResponse(contacts);
  }

  private async findMatchingContacts(email?: string, phoneNumber?: string): Promise<Contact[]> {
    let queryText = `
      WITH RECURSIVE contact_tree AS (
        -- Find direct matches
        SELECT * FROM contact 
        WHERE deleted_at IS NULL 
        AND (
          ($1::VARCHAR IS NOT NULL AND email = $1) 
          OR ($2::VARCHAR IS NOT NULL AND phone_number = $2)
        )
        
        UNION
        
        -- Find linked contacts (both directions)
        SELECT c.* FROM contact c
        INNER JOIN contact_tree ct ON (
          c.id = ct.linked_id OR c.linked_id = ct.id OR 
          (ct.linked_id IS NOT NULL AND c.id = ct.linked_id) OR
          (c.linked_id IS NOT NULL AND c.linked_id = ct.linked_id)
        )
        WHERE c.deleted_at IS NULL
      )
      SELECT DISTINCT * FROM contact_tree
      ORDER BY created_at ASC;
    `;

    const result = await query(queryText, [email || null, phoneNumber || null]);
    return result.rows.map(this.mapRowToContact);
  }

  private getPrimaryContacts(contacts: Contact[]): Contact[] {
    const primaries = contacts.filter(c => c.linkPrecedence === 'primary');
    return primaries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  private async mergePrimaryContacts(primaries: Contact[]): Promise<void> {
    const oldestPrimary = primaries[0];
    const otherPrimaries = primaries.slice(1);

    for (const primary of otherPrimaries) {
      await query(
        `UPDATE contact 
         SET linked_id = $1, link_precedence = 'secondary', updated_at = NOW()
         WHERE id = $2`,
        [oldestPrimary.id, primary.id]
      );

      await query(
        `UPDATE contact 
         SET linked_id = $1, updated_at = NOW()
         WHERE linked_id = $2`,
        [oldestPrimary.id, primary.id]
      );
    }
  }

  private needsNewSecondaryContact(
    contacts: Contact[],
    email?: string,
    phoneNumber?: string
  ): boolean {
    const hasEmail = email && contacts.some(c => c.email === email);
    const hasPhone = phoneNumber && contacts.some(c => c.phoneNumber === phoneNumber);
    
    // Create secondary if we have new information
    if (email && phoneNumber) {
      return !contacts.some(c => c.email === email && c.phoneNumber === phoneNumber);
    }
    
    return false;
  }

  private async createContact(
    email: string | undefined,
    phoneNumber: string | undefined,
    linkedId: number | null,
    linkPrecedence: 'primary' | 'secondary'
  ): Promise<Contact> {
    const result = await query(
      `INSERT INTO contact (email, phone_number, linked_id, link_precedence, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [email || null, phoneNumber || null, linkedId, linkPrecedence]
    );
    return this.mapRowToContact(result.rows[0]);
  }

  private buildResponse(contacts: Contact[]): IdentifyResponse {
    const primary = contacts.find(c => c.linkPrecedence === 'primary') || contacts[0];
    const secondaries = contacts.filter(c => c.linkPrecedence === 'secondary');

    const emails = [...new Set(contacts.map(c => c.email).filter(Boolean) as string[])];
    const phoneNumbers = [...new Set(contacts.map(c => c.phoneNumber).filter(Boolean) as string[])];

    // Ensure primary contact's info comes first
    if (primary.email) {
      emails.unshift(primary.email);
    }
    if (primary.phoneNumber) {
      phoneNumbers.unshift(primary.phoneNumber);
    }

    return {
      contact: {
        primaryContactId: primary.id,
        emails: [...new Set(emails)],
        phoneNumbers: [...new Set(phoneNumbers)],
        secondaryContactIds: secondaries.map(c => c.id),
      },
    };
  }

  private mapRowToContact(row: any): Contact {
    return {
      id: row.id,
      phoneNumber: row.phone_number,
      email: row.email,
      linkedId: row.linked_id,
      linkPrecedence: row.link_precedence,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}
