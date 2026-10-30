import { brandLogo } from '@brand/tokens'

export default function App() {
  return (
    <div className="app">
      <img className="splash-logo" src={brandLogo.red} alt="Clickable" />
    </div>
  )
}
