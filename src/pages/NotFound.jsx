import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="center-container">
      <div className="card text-center" style={{ maxWidth: '400px' }}>
        <h1 style={{ fontSize: '48px', color: 'var(--primary)' }}>404</h1>
        <h2>Page Not Found</h2>
        <p className="text-muted" style={{ margin: '12px 0 24px' }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

