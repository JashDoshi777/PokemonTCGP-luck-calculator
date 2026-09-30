import React from 'react';

// Catches render-time crashes (e.g. a corrupted stored value slipping past a
// parse guard, or a bad response from a live CDN) so the user gets a
// recoverable screen instead of a permanent white page.
//
// Use it twice: once around the whole app (full-screen fallback) and once around
// each page (`scope="page"`), so a problem in one section doesn't take the rest
// of the app down with it.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error(`Unhandled error in ${this.props.name || 'app'}:`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isPage = this.props.scope === 'page';
    return (
      <div
        role="alert"
        style={{
          minHeight: isPage ? '50vh' : '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '40px',
          textAlign: 'center',
          fontFamily: 'inherit',
        }}
      >
        <h1 style={{ fontSize: isPage ? '1.5rem' : '1.8rem', fontWeight: 800 }}>
          {isPage ? `${this.props.name || 'This section'} hit a problem.` : 'Something went wrong.'}
        </h1>
        <p style={{ color: '#888', maxWidth: '420px' }}>
          {isPage
            ? 'The rest of the app is fine. Try again, or reload the page if it keeps happening.'
            : 'The app hit an unexpected error. Reloading usually fixes it.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {isPage && (
            <button
              onClick={this.handleReset}
              style={{ padding: '12px 28px', borderRadius: '999px', border: 'none', background: '#1d1d1f', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Try again
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px',
              borderRadius: '999px',
              border: isPage ? '1px solid rgba(128,128,140,0.4)' : 'none',
              background: isPage ? 'transparent' : '#1d1d1f',
              color: isPage ? 'inherit' : '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
