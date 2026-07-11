/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso ao {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Seu link de acesso</Heading>
        <Text style={text}>
          Clique no botão abaixo para entrar no {siteName}. Este link expira em
          alguns minutos.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Entrar
        </Button>
        <Text style={footer}>
          Se você não solicitou este acesso, pode ignorar este e-mail com
          tranquilidade.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
const button = {
  backgroundColor: 'hsl(354, 30%, 55%)',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '4px',
  padding: '12px 24px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '8px 0 24px',
}
const footer = { fontSize: '12px', color: 'hsl(350, 12%, 55%)', margin: '28px 0 0' }
