// GET /api/crm/export?what=leads|partners|events&format=csv|json
// Xuất toàn bộ để (1) dán vào Google Sheet LIVE làm ARCHIVE/báo cáo, (2) backup tay hằng tuần.
// Cột theo đúng thứ tự tab Leads / Partners của Sheet để dán thẳng, không phải đổi tên.
import { json, err } from './_lib.js';

const LEAD_COLS = [
  ['id', 'Lead ID'], ['created_date', 'Created Date'], ['customer_name', 'Customer Name'], ['contact', 'Contact'],
  ['contact_channel', 'Contact Channel'], ['service', 'Service'], ['event_date', 'Event Date'], ['source', 'Source'],
  ['segment', 'Segment'], ['status', 'Status'], ['expected_revenue', 'Expected Revenue'], ['deposit', 'Deposit'],
  ['actual_revenue', 'Actual Revenue'], ['owner', 'Owner'], ['next_action', 'Next Action'], ['next_followup', 'Next Follow-up'],
  ['notes', 'Notes'], ['last_updated', 'Last Updated'], ['actual_verified', 'Actual Verified'], ['partner_id', 'Partner ID'], ['updated_by', 'Updated By']
];
const PARTNER_COLS = [
  ['id', 'Partner ID'], ['created_date', 'Created Date'], ['name', 'Partner / Studio'], ['type', 'Type'], ['contact_channel', 'Contact Channel'],
  ['contact', 'Contact'], ['status', 'Status'], ['last_touch', 'Last Touch'], ['opportunity', 'Opportunity'], ['commercial_terms', 'Commercial Terms'],
  ['next_action', 'Next Action'], ['next_followup', 'Next Follow-up'], ['notes', 'Notes'], ['owner', 'Owner'], ['referral_rate', 'Referral Rate'], ['last_updated', 'Last Updated']
];
const EVENT_COLS = [['id', 'Event #'], ['entity', 'Entity'], ['entity_id', 'ID'], ['ts', 'Time'], ['actor', 'By'], ['field', 'Field'], ['old_value', 'Old'], ['new_value', 'New']];

const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const what = u.searchParams.get('what') || 'leads';
  const format = u.searchParams.get('format') || 'csv';
  const map = { leads: ['leads', LEAD_COLS, 'created_date'], partners: ['partners', PARTNER_COLS, 'created_date'], events: ['lead_events', EVENT_COLS, 'id'] }[what];
  if (!map) return err('what phải là leads | partners | events');
  const [table, cols, order] = map;
  const rows = (await env.CRM_DB.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all()).results || [];
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') return json({ ok: true, what, count: rows.length, rows });
  const lines = [cols.map(c => csvCell(c[1])).join(',')];
  for (const r of rows) lines.push(cols.map(c => csvCell(r[c[0]])).join(','));
  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kinkay-crm-${what}-${stamp}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
