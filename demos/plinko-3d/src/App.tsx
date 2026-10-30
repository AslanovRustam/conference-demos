import { brandLogo } from '@brand/tokens';
import { S } from './strings';

export function App() {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 24 }}>
      <img src={brandLogo.red} alt="Clickable" style={{ height: 36 }} />
      <div style={{ fontFamily: 'var(--ck-font-display)', fontSize: 48, fontWeight: 900 }}>{S.drop}</div>
    </div>
  );
}
