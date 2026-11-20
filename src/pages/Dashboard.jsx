import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

export default function Dashboard() {
  const { user, business } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [customersCount, setCustomersCount] = useState(0);
  const [campaignsCount, setCampaignsCount] = useState(0);
  const [followUps, setFollowUps] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [custCountRes, campCountRes, fuRes, recentCustRes] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase
          .from('follow_ups')
          .select(`
            id,
            due_date,
            note,
            completed,
            customer_id,
            customers:customer_id (id, name, phone)
          `)
          .eq('completed', false)
          .order('due_date', { ascending: true }),
        supabase
          .from('customers')
          .select('id, name, phone, last_visit_date, visit_count')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      if (custCountRes.error) throw custCountRes.error;
      if (campCountRes.error) throw campCountRes.error;
      if (fuRes.error) throw fuRes.error;
      if (recentCustRes.error) throw recentCustRes.error;

      setCustomersCount(custCountRes.count ?? 0);
      setCampaignsCount(campCountRes.count ?? 0);
      setFollowUps(fuRes.data || []);
      setRecentCustomers(recentCustRes.data || []);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setErrorMsg('Failed to load dashboard statistics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  // Compute pending & overdue counts
  const overdueCount = useMemo(() => {
    return followUps.filter((fu) => fu.due_date < todayStr).length;
  }, [followUps, todayStr]);

  const overdueList = useMemo(() => {
    return followUps.filter((fu) => fu.due_date < todayStr);
  }, [followUps, todayStr]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome back to <strong>{business?.name || 'GrowthDesk'}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchDashboardData}>
            🔄 Refresh
          </button>
          <Link to="/messages" className="btn btn-primary btn-sm">
            💬 New WhatsApp Message
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-error" role="alert">
          {errorMsg}
        </div>
      )}

      {loading && (
        <div className="center-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading business metrics...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Metrics Stats Grid */}
          <div className="stats-grid">
            {/* Total Customers */}
            <div className="stat-card">
              <span className="stat-label">Total Customers</span>
              <div className="stat-value">{customersCount}</div>
              <div className="stat-subtext">
                <Link to="/customers">View directory &rarr;</Link>
              </div>
            </div>

            {/* Pending Follow-ups */}
            <div className="stat-card">
              <span className="stat-label">Pending Follow-ups</span>
              <div className="stat-value">{followUps.length}</div>
              <div className="stat-subtext">
                {overdueCount > 0 ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    ⚠️ {overdueCount} {overdueCount === 1 ? 'item is' : 'items are'} overdue
                  </span>
                ) : (
                  <span style={{ color: 'var(--success)', fontWeight: 500 }}>All on schedule</span>
                )}
              </div>
            </div>

            {/* Campaigns Created */}
            <div className="stat-card">
              <span className="stat-label">Broadcast Campaigns</span>
              <div className="stat-value">{campaignsCount}</div>
              <div className="stat-subtext">
                <Link to="/campaigns">Launch queue &rarr;</Link>
              </div>
            </div>
          </div>

          {/* Overdue Action Banner */}
          {overdueList.length > 0 && (
            <div
              className="card"
              style={{
                borderColor: 'var(--danger-border)',
                backgroundColor: 'var(--danger-light)',
                padding: '18px 24px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠️</span> {overdueList.length} Overdue Follow-up{overdueList.length > 1 ? 's' : ''} Need Attention
                </h3>
                <Link to="/follow-ups" className="btn btn-danger-outline btn-sm">
                  View All Follow-ups
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {overdueList.slice(0, 3).map((fu) => (
                  <div
                    key={fu.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px'
                    }}
                  >
                    <div>
                      <strong>{fu.customers?.name || 'Customer'}</strong> — Due: {fu.due_date}{' '}
                      <span className="badge badge-danger">OVERDUE</span>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                        {fu.note || 'No note'}
                      </div>
                    </div>
                    {fu.customers?.phone && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          navigate('/messages', {
                            state: {
                              selectedCustomerId: fu.customer_id,
                              followUpNote: fu.note
                            }
                          })
                        }
                      >
                        💬 WhatsApp
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Action Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Quick Actions */}
            <div className="card">
              <h3 className="card-title">Quick Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                <Link to="/customers" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  👥 Manage Customers &amp; Add New
                </Link>
                <Link to="/follow-ups" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  ⏰ Schedule Customer Follow-up
                </Link>
                <Link to="/messages" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  💬 Generate 1-Click WhatsApp Message
                </Link>
                <Link to="/campaigns" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  📢 Create Broadcast Campaign
                </Link>
                <Link to="/settings" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  ⚙️ Business Settings &amp; Data Backup
                </Link>
              </div>
            </div>

            {/* Recent Customers */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 className="card-title">Recent Clients</h3>
                <Link to="/customers" style={{ fontSize: '13px' }}>
                  View All
                </Link>
              </div>

              {recentCustomers.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '13px', fontStyle: 'italic' }}>
                  No clients enrolled yet. <Link to="/customers">Add your first client</Link>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentCustomers.map((cust) => (
                    <div
                      key={cust.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'var(--bg-page)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{cust.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {cust.phone || 'No phone'}
                        </div>
                      </div>
                      <span className="badge badge-success">{cust.visit_count ?? 0} visits</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
