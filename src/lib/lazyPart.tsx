/**
 * Loading parts of the app on demand (sign-in, notes) safely:
 * - after a new version is published, a tab that was already open may ask for a piece that no longer
 *   exists; then the page reloads once to get the new version, instead of going blank;
 * - if a part ever fails while showing, only that part says so (the reader and map keep working).
 */
import { Component, lazy, type ComponentType, type ReactNode } from 'react';

const FLAG = 'reloaded-for-update';

export function lazyPart<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return lazy(() =>
    load()
      .then((m) => {
        try {
          sessionStorage.removeItem(FLAG);
        } catch {
          /* ignore */
        }
        return m;
      })
      .catch((e) => {
        let reloaded = false;
        try {
          reloaded = sessionStorage.getItem(FLAG) === '1';
          if (!reloaded) sessionStorage.setItem(FLAG, '1');
        } catch {
          reloaded = true;
        }
        if (!reloaded) {
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
        throw e;
      }),
  );
}

export class PartBoundary extends Component<{ children: ReactNode; onClose?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.error('part failed', e);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="modal-backdrop" onClick={this.props.onClose}>
        <div className="modal acct" onClick={(e) => e.stopPropagation()} role="alert">
          <h2>Something went wrong</h2>
          <p>This part of the app couldn’t open. Your notes and account are safe. Please reload the page and try again.</p>
          <div className="acct-actions">
            <button className="btn primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            {this.props.onClose && (
              <button
                className="btn"
                onClick={() => {
                  this.setState({ failed: false });
                  this.props.onClose?.();
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
