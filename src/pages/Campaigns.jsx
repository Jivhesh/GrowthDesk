import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import CampaignModal from '../components/CampaignModal';
import { normalizePhoneNumber, generateWaLink } from '../lib/phoneUtils';

export default function Campaigns() {
  const { user, business } = useAuth();

  const [campaigns, setCampaigns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [deletingCampaign, setDeletingCampaign] = useState(null);

  // Active Dispatch / Send Queue State
  const [activeDispatchCampaign, setActiveDispatchCampaign] = useState(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(new Set());
  const [sentCustomerIds, setSentCustomerIds] = useState(new Set());
  const [recipientTagFilter, setRecipientTagFilter] = useState('');

  const businessName = business?.name || 'our business';
  const defaultCountryCode = business?.default_country_code || '+91';

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [campRes, custRes] = await Promise.all([
        supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('name')
      ]);

      if (campRes.error) throw campRes.error;
      if (custRes.error) throw custRes.error;

      setCampaigns(campRes.data || []);
      setCustomers(custRes.data || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setErrorMsg('Failed to load campaigns: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Extract all tags for filtering recipients
  const allCustomerTags = useMemo(() => {
    const set = new Set();
    customers.forEach((c) => {
      if (Array.isArray(c.tags)) {
        c.tags.forEach((t) => t && set.add(t));
      }
    });
    return Array.from(set).sort();
  }, [customers]);

  // Save campaign (create or update)
  const handleSaveCampaign = async (formData) => {
    if (!user) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      if (editingCampaign) {
        const { data, error } = await supabase
          .from('campaigns')
          .update({
            ...formData,
            business_id: user.id
          })
          .eq('id', editingCampaign.id)
          .select()
          .single();

        if (error) throw error;
        setCampaigns((prev) => prev.map((c) => (c.id === editingCampaign.id ? data : c)));
      } else {
        const { data, error } = await supabase
          .from('campaigns')
          .insert({
            ...formData,
            business_id: user.id
          })
          .select()
          .single();

        if (error) throw error;
        setCampaigns((prev) => [data, ...prev]);
      }
      setIsModalOpen(false);
      setEditingCampaign(null);
    } catch (err) {
      console.error('Error saving campaign:', err);
      setErrorMsg('Failed to save campaign: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete campaign
  const handleDeleteCampaign = async () => {
    if (!deletingCampaign || !user) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', deletingCampaign.id);

      if (error) throw error;
      setCampaigns((prev) => prev.filter((c) => c.id !== deletingCampaign.id));
      if (activeDispatchCampaign?.id === deletingCampaign.id) {
        setActiveDispatchCampaign(null);
      }
      setDeletingCampaign(null);
    } catch (err) {
      console.error('Error deleting campaign:', err);
      setErrorMsg('Failed to delete campaign: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Start dispatching a campaign
  const handleStartDispatch = (camp) => {
    setActiveDispatchCampaign(camp);
    // Pre-select all customers who have a phone number by default
    const validIds = new Set();
    customers.forEach((c) => {
      const p = normalizePhoneNumber(c.phone, defaultCountryCode);
      if (p.valid) validIds.add(c.id);
    });
    setSelectedCustomerIds(validIds);
    setSentCustomerIds(new Set());
    setRecipientTagFilter('');
  };

  // Toggle single customer in queue
  const toggleCustomerSelection = (custId) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(custId)) {
        next.delete(custId);
      } else {
        next.add(custId);
      }
      return next;
    });
  };

  // Select all matching filter
  const selectAllMatching = (list) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      list.forEach((c) => {
        const p = normalizePhoneNumber(c.phone, defaultCountryCode);
        if (p.valid) next.add(c.id);
      });
      return next;
    });
  };

  // Deselect all matching
  const deselectAllMatching = (list) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      list.forEach((c) => next.delete(c.id));
      return next;
    });
  };

  // Filtered customer list for recipient selection
  const eligibleCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (!recipientTagFilter) return true;
      return Array.isArray(c.tags) && c.tags.includes(recipientTagFilter);
    });
  }, [customers, recipientTagFilter]);

  // Active queue list of selected customers
  const queuedCustomers = useMemo(() => {
    return customers.filter((c) => selectedCustomerIds.has(c.id));
  }, [customers, selectedCustomerIds]);

  // Mark a customer as sent when clicking send
  const handleMarkSent = (custId) => {
    setSentCustomerIds((prev) => new Set(prev).add(custId));
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Create message broadcasts and dispatch via WhatsApp safe send queue</p>
        </div>
        {!activeDispatchCampaign && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingCampaign(null);
              setIsModalOpen(true);
            }}
          >
            + Create Campaign
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="alert alert-error" role="alert">
          {errorMsg}
        </div>
      )}

      {loading && (
        <div className="center-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading campaigns...</p>
        </div>
      )}

      {/* DISPATCH SEND QUEUE VIEW */}
      {!loading && activeDispatchCampaign && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ borderColor: 'var(--primary-border)', backgroundColor: 'var(--primary-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span className="badge badge-success" style={{ marginBottom: '6px' }}>
                  Active Dispatch Mode
                </span>
                <h2 style={{ fontSize: '20px', color: 'var(--text-main)' }}>{activeDispatchCampaign.name}</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Template: &quot;{activeDispatchCampaign.message_template}&quot;
                </p>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setActiveDispatchCampaign(null)}
              >
                &larr; Exit Queue
              </button>
            </div>

            {/* Queue Progress Bar */}
            <div style={{ marginTop: '16px', background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span>
                  <strong>Send Progress:</strong> {sentCustomerIds.size} of {queuedCustomers.length} sent
                </span>
                <span style={{ fontWeight: 600 }}>
                  {queuedCustomers.length > 0
                    ? Math.round((sentCustomerIds.size / queuedCustomers.length) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    backgroundColor: 'var(--success)',
                    width: `${
                      queuedCustomers.length > 0
                        ? (sentCustomerIds.size / queuedCustomers.length) * 100
                        : 0
                    }%`,
                    transition: 'width 0.3s ease'
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Filter & Recipient Controls */}
          <div className="card">
            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Choose Target Recipients</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
              {allCustomerTags.length > 0 && (
                <div style={{ minWidth: '180px' }}>
                  <select
                    value={recipientTagFilter}
                    onChange={(e) => setRecipientTagFilter(e.target.value)}
                    aria-label="Filter target recipients by tag"
                  >
                    <option value="">All Customer Tags ({customers.length})</option>
                    {allCustomerTags.map((tag) => (
                      <option key={tag} value={tag}>
                        Tag: {tag}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => selectAllMatching(eligibleCustomers)}
              >
                Select All ({eligibleCustomers.length})
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => deselectAllMatching(eligibleCustomers)}
              >
                Deselect All
              </button>
              {sentCustomerIds.size > 0 && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setSentCustomerIds(new Set())}
                  style={{ marginLeft: 'auto' }}
                >
                  Reset Session Status
                </button>
              )}
            </div>

            <div className="alert alert-warning" style={{ fontSize: '13px', margin: '0 0 16px' }}>
              💡 <strong>Browser Note:</strong> Modern browsers block mass opening of multiple tabs at once. Use the send queue below to trigger personalized WhatsApp messages one by one with a single click.
            </div>

            {queuedCustomers.length === 0 ? (
              <div className="text-center" style={{ padding: '24px', color: 'var(--text-muted)' }}>
                No customers selected for this campaign queue. Select at least one customer above.
              </div>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Queue</th>
                      <th>Customer &amp; Phone</th>
                      <th>Personalized Message Preview</th>
                      <th style={{ textAlign: 'right', minWidth: '180px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queuedCustomers.map((cust) => {
                      const phoneVal = normalizePhoneNumber(cust.phone, defaultCountryCode);
                      const isSent = sentCustomerIds.has(cust.id);

                      const personalizedMsg = activeDispatchCampaign.message_template
                        .replace(/\{name\}/g, cust.name || 'Friend')
                        .replace(/\{business\}/g, businessName);

                      const link = phoneVal.valid ? generateWaLink(phoneVal.number, personalizedMsg) : '#';

                      return (
                        <tr
                          key={cust.id}
                          style={{
                            backgroundColor: isSent ? 'var(--success-light)' : undefined,
                            opacity: isSent ? 0.75 : 1
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedCustomerIds.has(cust.id)}
                              onChange={() => toggleCustomerSelection(cust.id)}
                              aria-label={`Select ${cust.name}`}
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{cust.name}</div>
                            {phoneVal.valid ? (
                              <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                +{phoneVal.number}
                              </div>
                            ) : (
                              <div style={{ fontSize: '12px', color: 'var(--danger)' }}>{phoneVal.error}</div>
                            )}
                          </td>
                          <td>
                            <div
                              style={{
                                fontSize: '13px',
                                color: 'var(--text-main)',
                                maxWidth: '420px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={personalizedMsg}
                            >
                              &quot;{personalizedMsg}&quot;
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {isSent && <span className="badge badge-success">✓ Sent</span>}
                              <a
                                href={phoneVal.valid ? link : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`btn btn-sm ${isSent ? 'btn-outline' : 'btn-success'}`}
                                onClick={() => handleMarkSent(cust.id)}
                                style={{
                                  pointerEvents: phoneVal.valid ? 'auto' : 'none',
                                  opacity: phoneVal.valid ? 1 : 0.4
                                }}
                              >
                                {isSent ? 'Resend' : 'Send via WhatsApp'}
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CAMPAIGN LIST VIEW */}
      {!loading && !activeDispatchCampaign && campaigns.length === 0 && (
        <div className="card text-center" style={{ padding: '48px 24px' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>📢</div>
          <h3>No campaigns created yet</h3>
          <p className="text-muted" style={{ maxWidth: '440px', margin: '8px auto 20px' }}>
            Create reusable WhatsApp announcement templates with client name placeholders and broadcast them through the safe send queue.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingCampaign(null);
              setIsModalOpen(true);
            }}
          >
            + Create Your First Campaign
          </button>
        </div>
      )}

      {!loading && !activeDispatchCampaign && campaigns.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {campaigns.map((camp) => (
            <div key={camp.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 className="card-title" style={{ color: 'var(--text-main)' }}>{camp.name}</h3>
                <div
                  style={{
                    backgroundColor: 'var(--bg-page)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    marginTop: '10px',
                    whiteSpace: 'pre-wrap',
                    minHeight: '75px'
                  }}
                >
                  {camp.message_template}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleStartDispatch(camp)}
                >
                  🚀 Launch Send Queue
                </button>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setEditingCampaign(camp);
                      setIsModalOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => setDeletingCampaign(camp)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign Create/Edit Modal */}
      <CampaignModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCampaign(null);
        }}
        onSave={handleSaveCampaign}
        campaign={editingCampaign}
        loading={actionLoading}
      />

      {/* Delete Campaign Confirmation */}
      {deletingCampaign && (
        <div className="modal-overlay" onClick={() => setDeletingCampaign(null)} role="dialog" aria-modal="true">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Campaign</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeletingCampaign(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <p style={{ fontSize: '14px' }}>
              Are you sure you want to delete the campaign <strong>{deletingCampaign.name}</strong>?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeletingCampaign(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteCampaign}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Delete Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
