import { brandLogo } from '@brand/tokens'

// placeholder: black screen with the logo, proves the @brand alias works
export default function App() {
  return <img src={brandLogo.red} alt="Clickable" style={{ position: 'absolute', top: 16, left: 16, height: 24 }} />
}
