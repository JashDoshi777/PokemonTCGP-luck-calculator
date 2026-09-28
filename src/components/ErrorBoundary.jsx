import React from 'react';

// Catches render-time crashes (e.g. a corrupted stored value slipping past a
// parse guard, or a bad response from a live CDN) so the user gets a
// recoverable screen instead of a permanent white page.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '40px',
          textAlign: 'center',
          fontFamily: 'inherit',
        }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Something went wrong.</h1>
          <p style={{ color: '#888', maxWidth: '420px' }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px',
              borderRadius: '999px',
              border: 'none',
              background: '#1d1d1f',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
