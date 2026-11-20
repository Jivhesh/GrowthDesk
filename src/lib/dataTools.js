/**
 * GrowthDesk Data Tools: CSV Export, JSON Backup, and Relational Restore
 */

// Prefix characters that could trigger spreadsheet formula execution in Excel/Sheets
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escapes a single CSV cell value and guards against formula injection
 */
export function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Formula injection prevention
  if (FORMULA_TRIGGERS.some((char) => str.startsWith(char))) {
    str = "'" + str;
  }

  // Escape inner double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Exports customers array to a CSV string and initiates a browser download
 */
export function exportCustomersToCsv(customers, businessName = 'GrowthDesk') {
  const headers = [
    'Name',
    'Phone',
    'Email',
    'Tags',
    'Visit Count',
    'Last Visit Date',
    'Notes',
    'Created At'
  ];

  const rows = customers.map((c) => [
    escapeCsvCell(c.name),
    escapeCsvCell(c.phone || ''),
    escapeCsvCell(c.email || ''),
    escapeCsvCell(Array.isArray(c.tags) ? c.tags.join('; ') : ''),
    escapeCsvCell(c.visit_count ?? 0),
    escapeCsvCell(c.last_visit_date || ''),
    escapeCsvCell(c.notes || ''),
    escapeCsvCell(c.created_at || '')
  ]);

  const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const sanitizedName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `${sanitizedName}_customers_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads full JSON backup of customers, follow-ups, and campaigns
 */
export function downloadJsonBackup({ customers, followUps, campaigns, business }) {
  const backup = {
    version: '1.0',
    app: 'GrowthDesk',
    exported_at: new Date().toISOString(),
    business: {
      name: business?.name || '',
      type: business?.type || '',
      phone: business?.phone || '',
      default_country_code: business?.default_country_code || '+91'
    },
    data: {
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || null,
        email: c.email || null,
        tags: c.tags || [],
        notes: c.notes || null,
        last_visit_date: c.last_visit_date || null,
        visit_count: c.visit_count ?? 0,
        created_at: c.created_at
      })),
      follow_ups: followUps.map((fu) => ({
        id: fu.id,
        customer_id: fu.customer_id,
        due_date: fu.due_date,
        note: fu.note || null,
        completed: Boolean(fu.completed),
        completed_at: fu.completed_at || null,
        created_at: fu.created_at
      })),
      campaigns: campaigns.map((camp) => ({
        id: camp.id,
        name: camp.name,
        message_template: camp.message_template,
        created_at: camp.created_at
      }))
    }
  };

  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const sanitizedName = (business?.name || 'growthdesk').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `${sanitizedName}_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates a parsed JSON backup file structure and field types
 */
export function validateBackupStructure(jsonObj) {
  if (!jsonObj || typeof jsonObj !== 'object') {
    return { valid: false, error: 'File is not a valid JSON object.' };
  }

  // Handle both { data: { customers, follow_ups, campaigns } } and direct structure
  const data = jsonObj.data || jsonObj;

  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Backup is missing the data payload.' };
  }

  const rawCustomers = Array.isArray(data.customers) ? data.customers : [];
  const rawFollowUps = Array.isArray(data.follow_ups) ? data.follow_ups : [];
  const rawCampaigns = Array.isArray(data.campaigns) ? data.campaigns : [];

  if (rawCustomers.length === 0 && rawFollowUps.length === 0 && rawCampaigns.length === 0) {
    return {
      valid: false,
      error: 'The backup file contains no customers, follow-ups, or campaigns to restore.'
    };
  }

  // Validate customers structure
  for (let i = 0; i < rawCustomers.length; i++) {
    const c = rawCustomers[i];
    if (!c || typeof c !== 'object' || !c.name || typeof c.name !== 'string') {
      return {
        valid: false,
        error: `Customer at position ${i + 1} is missing a required name string.`
      };
    }
  }

  // Validate follow-ups structure
  for (let i = 0; i < rawFollowUps.length; i++) {
    const fu = rawFollowUps[i];
    if (!fu || typeof fu !== 'object' || !fu.due_date) {
      return {
        valid: false,
        error: `Follow-up at position ${i + 1} is missing a required due_date.`
      };
    }
  }

  // Validate campaigns structure
  for (let i = 0; i < rawCampaigns.length; i++) {
    const camp = rawCampaigns[i];
    if (!camp || typeof camp !== 'object' || !camp.name || !camp.message_template) {
      return {
        valid: false,
        error: `Campaign at position ${i + 1} is missing a required name or message_template.`
      };
    }
  }

  return {
    valid: true,
    error: null,
    counts: {
      customers: rawCustomers.length,
      followUps: rawFollowUps.length,
      campaigns: rawCampaigns.length
    },
    cleanedData: {
      customers: rawCustomers,
      followUps: rawFollowUps,
      campaigns: rawCampaigns
    }
  };
}

/**
 * Restores data into Supabase under the current user's business_id:
 * - Ignores any foreign business_id or id in file
 * - Inserts all customers with current userId
 * - Maps old_customer_id -> new_customer_id
 * - Inserts follow-ups with relinked customer_id and current userId
 * - Inserts campaigns with current userId
 * - Adds to existing data (never deletes current data)
 */
export async function executeRestore({ cleanedData, userId, supabase }) {
  if (!supabase || !userId) throw new Error('Missing Supabase client or user session');

  const { customers, followUps, campaigns } = cleanedData;
  const oldToNewCustMap = new Map();

  let importedCustomers = 0;
  let importedFollowUps = 0;
  let importedCampaigns = 0;

  // 1. Insert Customers one by one or in batch
  for (const cust of customers) {
    const oldId = cust.id;
    const { data: newCust, error: custErr } = await supabase
      .from('customers')
      .insert({
        business_id: userId,
        name: cust.name,
        phone: cust.phone || null,
        email: cust.email || null,
        tags: Array.isArray(cust.tags) ? cust.tags : [],
        notes: cust.notes || null,
        last_visit_date: cust.last_visit_date || null,
        visit_count: cust.visit_count ?? 0
      })
      .select('id')
      .single();

    if (custErr) {
      console.error('Error restoring customer:', cust.name, custErr);
      continue;
    }

    importedCustomers++;
    if (oldId && newCust?.id) {
      oldToNewCustMap.set(oldId, newCust.id);
    }
  }

  // 2. Insert Follow-ups with relinked customer IDs
  for (const fu of followUps) {
    const newCustId = oldToNewCustMap.get(fu.customer_id);
    // If we can't link to a newly restored customer, skip or insert if possible
    if (!newCustId) {
      console.warn('Skipping follow-up: original customer ID not found in restored set', fu);
      continue;
    }

    const { error: fuErr } = await supabase.from('follow_ups').insert({
      business_id: userId,
      customer_id: newCustId,
      due_date: fu.due_date,
      note: fu.note || null,
      completed: Boolean(fu.completed),
      completed_at: fu.completed_at || null
    });

    if (fuErr) {
      console.error('Error restoring follow-up:', fuErr);
      continue;
    }
    importedFollowUps++;
  }

  // 3. Insert Campaigns
  for (const camp of campaigns) {
    const { error: campErr } = await supabase.from('campaigns').insert({
      business_id: userId,
      name: camp.name,
      message_template: camp.message_template
    });

    if (campErr) {
      console.error('Error restoring campaign:', camp.name, campErr);
      continue;
    }
    importedCampaigns++;
  }

  return {
    importedCustomers,
    importedFollowUps,
    importedCampaigns
  };
}

