import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import {
  exportCustomersToCsv,
  downloadJsonBackup,
  validateBackupStructure,
  executeRestore
} from '../lib/dataTools';

const BUSINESS_TYPES = [
  'Salon / Spa',
  'Gym / Fitness',
  'Restaurant / Cafe',
  'Coaching Centre / Tutor',
  'Dental / Clinic',
  'Retail Store',
  'Other Local Business'
];

export default function Settings() {
  const { user, business, refreshBusiness } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const fileInputRef = useRef(null);

  // Business settings form state
  const [name, setName] = useState('');
  const [type, setType] = useState('Salon / Spa');
  const [phone, setPhone] = useState('');
  const [defaultCountryCode, setDefaultCountryCode] = useState('+91');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(null);
  const [settingsError, setSettingsError] = useState(null);

  // Data Tools state
  const [dataToolLoading, setDataToolLoading] = useState(false);
  const [dataToolSuccess, setDataToolSuccess] = useState(null);
  const [dataToolError, setDataToolError] = useState(null);

  // Backup restore state
  const [pendingRestore, setPendingRestore] = useState(null);

  useEffect(() => {
    if (business) {
      setName(business.name || '');
      setType(business.type || 'Salon / Spa');
      setPhone(business.phone || '');
      setDefaultCountryCode(business.default_country_code || '+91');
    }
  }, [business]);

  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setSettingsError('Business name cannot be empty.');
      return;
    }

    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name: name.trim(),
          type,
          phone: phone.trim(),
          default_country_code: defaultCountryCode.trim() || '+91'
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshBusiness();
      setSettingsSuccess('Business profile updated successfully!');
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err) {
      console.error('Error updating business:', err);
      setSettingsError('Failed to update business profile: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    if (!user) return;
    setDataToolLoading(true);
    setDataToolError(null);
    setDataToolSuccess(null);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      if (!data || data.length === 0) {
        setDataToolError('No customers to export.');
        return;
      }
      exportCustomersToCsv(data, business?.name || 'GrowthDesk');
      setDataToolSuccess(`Successfully exported ${data.length} customers to CSV.`);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setDataToolError('Failed to export CSV: ' + err.message);
    } finally {
      setDataToolLoading(false);
    }
  };

  // JSON Backup Download
  const handleDownloadBackup = async () => {
    if (!user) return;
    setDataToolLoading(true);
    setDataToolError(null);
    setDataToolSuccess(null);
    try {
      const [custRes, fuRes, campRes] = await Promise.all([
        supabase.from('customers').select('*').order('created_at'),
        supabase.from('follow_ups').select('*').order('created_at'),
        supabase.from('campaigns').select('*').order('created_at')
      ]);

      if (custRes.error) throw custRes.error;
      if (fuRes.error) throw fuRes.error;
      if (campRes.error) throw campRes.error;

      downloadJsonBackup({
        customers: custRes.data || [],
        followUps: fuRes.data || [],
        campaigns: campRes.data || [],
        business
      });

      setDataToolSuccess('Complete JSON backup generated and downloaded!');
    } catch (err) {
      console.error('Error downloading backup:', err);
      setDataToolError('Failed to generate backup: ' + err.message);
    } finally {
      setDataToolLoading(false);
    }
  };

  // Handle file select for restore
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDataToolError(null);
    setDataToolSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const validation = validateBackupStructure(parsed);
        if (!validation.valid) {
          setDataToolError('Backup validation failed: ' + validation.error);
          setPendingRestore(null);
          return;
        }
        setPendingRestore(validation);
      } catch (err) {
        setDataToolError('Invalid file: Could not parse JSON. ' + err.message);
        setPendingRestore(null);
      }
    };
    reader.onerror = () => {
      setDataToolError('Error reading backup file.');
      setPendingRestore(null);
    };
    reader.readAsText(file);
    // Reset file input so same file can be re-selected if needed
    e.target.value = '';
  };

  // Confirm and execute restore
  const handleConfirmRestore = async () => {
    if (!pendingRestore || !user) return;
    setDataToolLoading(true);
    setDataToolError(null);
    try {
      const result = await executeRestore({
        cleanedData: pendingRestore.cleanedData,
        userId: user.id,
        supabase
      });

      setDataToolSuccess(
        `Backup restored successfully! Added ${result.importedCustomers} customers, ${result.importedFollowUps} follow-ups, and ${result.importedCampaigns} campaigns to your existing data.`
      );
      setPendingRestore(null);
    } catch (err) {
      console.error('Error restoring data:', err);
      setDataToolError('Restore failed: ' + err.message);
    } finally {
      setDataToolLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings &amp; Data Tools</h1>
          <p className="page-subtitle">Manage business profile, defaults, data backups, and restore</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        {/* Business Profile Settings */}
        <div className="card">
          <h2 className="card-title">Business Profile</h2>
          <p className="text-muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
            Used across campaign templates, greeting messages, and receipts.
          </p>

          {settingsError && (
            <div className="alert alert-error" role="alert">
              {settingsError}
            </div>
          )}
          {settingsSuccess && (
            <div className="alert alert-success" role="alert">
              {settingsSuccess}
            </div>
          )}

          <form onSubmit={handleSaveBusiness}>
            <div className="form-group">
              <label htmlFor="biz-name">Business Name *</label>
              <input
                id="biz-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={savingSettings}
              />
            </div>

            <div className="form-group">
              <label htmlFor="biz-type">Business Category</label>
              <select
                id="biz-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={savingSettings}
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="biz-phone">Business Contact Phone</label>
              <input
                id="biz-phone"
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={savingSettings}
              />
            </div>

            <div className="form-group">
              <label htmlFor="biz-country-code">Default Country Code (for WhatsApp)</label>
              <input
                id="biz-country-code"
                type="text"
                placeholder="+91"
                value={defaultCountryCode}
                onChange={(e) => setDefaultCountryCode(e.target.value)}
                disabled={savingSettings}
              />
              <span className="form-hint">
                Prepended to client numbers that lack an international dialing code (e.g. +91, +1, +44).
              </span>
            </div>

            <div style={{ marginTop: '20px' }}>
              <button type="submit" className="btn btn-primary" disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Data Tools (Export / Backup / Restore) */}
        <div className="card">
          <h2 className="card-title">Data Backup &amp; Portability</h2>
          <p className="text-muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
            Safeguard your records with instant exports and complete relational backups.
          </p>

          {dataToolError && (
            <div className="alert alert-error" role="alert">
              {dataToolError}
            </div>
          )}
          {dataToolSuccess && (
            <div className="alert alert-success" role="alert">
              {dataToolSuccess}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* CSV Export */}
            <div style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Export Customers to CSV</div>
              <p className="text-muted" style={{ fontSize: '13px', margin: '4px 0 12px' }}>
                Download all client contacts with visit statistics and tags. Includes formula injection protection for spreadsheet safety.
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleExportCsv}
                disabled={dataToolLoading}
              >
                📥 Export Customers (.csv)
              </button>
            </div>

            {/* JSON Backup */}
            <div style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Download Full JSON Backup</div>
              <p className="text-muted" style={{ fontSize: '13px', margin: '4px 0 12px' }}>
                Download complete database snapshot containing all customers, scheduled follow-ups, and campaigns.
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleDownloadBackup}
                disabled={dataToolLoading}
              >
                💾 Download Full Backup (.json)
              </button>
            </div>

            {/* JSON Restore */}
            <div style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Restore From JSON Backup</div>
              <p className="text-muted" style={{ fontSize: '13px', margin: '4px 0 12px' }}>
                Import records into your account. Always adds to existing records (never overwrites or deletes current data).
              </p>

              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={dataToolLoading}
              >
                📂 Choose Backup File (.json)
              </button>

              {/* Restore Confirmation Dialog */}
              {pendingRestore && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '14px',
                    backgroundColor: 'var(--warning-light)',
                    border: '1px solid var(--warning-border)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <h4 style={{ color: '#92400e', marginBottom: '8px', fontSize: '14px' }}>
                    Confirm Backup Import
                  </h4>
                  <p style={{ fontSize: '13px', color: '#92400e', marginBottom: '8px' }}>
                    Found the following records ready to import:
                  </p>
                  <ul style={{ fontSize: '13px', color: '#92400e', paddingLeft: '20px', marginBottom: '12px' }}>
                    <li><strong>{pendingRestore.counts.customers}</strong> Customers</li>
                    <li><strong>{pendingRestore.counts.followUps}</strong> Follow-ups (relinquished to new customer IDs)</li>
                    <li><strong>{pendingRestore.counts.campaigns}</strong> Campaigns</li>
                  </ul>
                  <p style={{ fontSize: '12px', color: '#78350f', marginBottom: '14px' }}>
                    🛡️ <strong>Safety note:</strong> This action will append these records under your business. Your existing data will remain completely intact.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleConfirmRestore}
                      disabled={dataToolLoading}
                    >
                      {dataToolLoading ? 'Restoring...' : 'Confirm & Add to Existing Data'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setPendingRestore(null)}
                      disabled={dataToolLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Minimalist Monkeytype-Style Theme Selector Card */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h2 className="card-title">Minimalist Theme Palette</h2>
          <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
            Choose a distraction-free, high-contrast aesthetic inspired by Monkeytype.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            {themes.map((t) => {
              const isSelected = theme === t.id;
              // Swatch colors
              const swatches = {
                'dark': { bg: '#18181b', surf: '#202024', accent: '#e2b714' },
                'light': { bg: '#f9fafb', surf: '#ffffff', accent: '#18181b' },
                'oled': { bg: '#000000', surf: '#0c0c0e', accent: '#ffffff' }
              }[t.id] || { bg: '#18181b', surf: '#202024', accent: '#e2b714' };

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '14px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: swatches.surf,
                    color: t.id === 'light' ? '#09090b' : '#fafafa',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: isSelected ? '0 0 0 2px var(--primary-light)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>
                      {t.icon} {t.name}
                    </span>
                    {isSelected && (
                      <span className="badge badge-success" style={{ fontSize: '10px', padding: '1px 6px' }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ width: '24px', height: '14px', borderRadius: '3px', backgroundColor: swatches.bg, border: '1px solid rgba(128,128,128,0.3)' }} title="Background"></div>
                    <div style={{ width: '24px', height: '14px', borderRadius: '3px', backgroundColor: swatches.surf, border: '1px solid rgba(128,128,128,0.3)' }} title="Surface"></div>
                    <div style={{ width: '24px', height: '14px', borderRadius: '3px', backgroundColor: swatches.accent }} title="Accent"></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
