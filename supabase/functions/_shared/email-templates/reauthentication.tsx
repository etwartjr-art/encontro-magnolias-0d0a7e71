/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirmar identidade</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código expira em alguns minutos. Se você não fez esta solicitação,
          pode ignorar este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const h1 = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: '28px',
  fontWeight: 'normal' as const,
  color: 'hsl(350, 18%, 22%)',
  margin: '0 0 24px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(350, 12%, 42%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: 'hsl(354, 30%, 55%)',
  letterSpacing: '4px',
  margin: '0 0 24px',
}
const footer = { fontSize: '12px', color: 'hsl(350, 12%, 55%)', margin: '28px 0 0' }
