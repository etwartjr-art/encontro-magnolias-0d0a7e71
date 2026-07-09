-- Corrige finding crítico: senha de admin fraca ('12345678') semeada em migração anterior.
-- Substitui a senha do admin por uma senha aleatória forte. O admin deverá redefinir
-- via "Esqueci minha senha" (link enviado por e-mail).
DO $$
DECLARE
  admin_uid UUID;
  random_pw TEXT;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'etwartjr@gmail.com';
  IF admin_uid IS NOT NULL THEN
    -- 48 chars aleatórios em base64 -> senha forte e desconhecida
    random_pw := encode(gen_random_bytes(36), 'base64');
    UPDATE auth.users
      SET encrypted_password = crypt(random_pw, gen_salt('bf')),
          updated_at = now()
      WHERE id = admin_uid;
  END IF;
END $$;