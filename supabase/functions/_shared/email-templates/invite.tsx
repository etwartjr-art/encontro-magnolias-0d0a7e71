/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidada para o {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Você foi convidada</Heading>
        <Text style={text}>
          Você recebeu um convite para participar do{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Clique no botão abaixo para aceitar e criar sua conta.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Aceitar convite
        </Button>
        <Text style={footer}>
          Se você não esperava este convite, pode ignorar este e-mail com
          tranquilidade.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
const link = { color: 'hsl(354, 30%, 55%)', textDecoration: 'underline' }
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
