import { z } from "zod";

/**
 * Endereço oficial do 3º Encontro das Magnólias.
 * Fonte única de verdade — usar SEMPRE estes campos para exibir o endereço,
 * gerar QR codes, links de mapa, metadados, etc.
 */
const rawEventAddress = {
  venue: "Condomínio Ecopark",
  street: "Av. João Leite",
  number: "1031",
  block: "01", // Quadra
  lot: "35", // Lote
  house: "33", // Casa
  neighborhood: "Santa Genoveva",
  city: "Goiânia",
  state: "GO",
  cep: "74672020", // apenas dígitos — formatado pelos helpers
} as const;

/**
 * Schema de validação para CEP brasileiro.
 * Aceita "00000-000" ou "00000000" e normaliza para "00000-000".
 */
export const cepSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 8, { message: "CEP deve conter 8 dígitos" })
  .transform((v) => `${v.slice(0, 5)}-${v.slice(5)}`);

/** Formata uma string de dígitos no padrão CEP "00000-000". Retorna "" se inválido. */
export const formatCep = (value: string): string => {
  const result = cepSchema.safeParse(value);
  return result.success ? result.data : "";
};

/** Máscara progressiva para inputs de CEP (digitação). */
export const maskCepInput = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const eventAddressSchema = z.object({
  venue: z.string().trim().min(1),
  street: z.string().trim().min(1),
  number: z.string().trim().regex(/^\d+$/, "Número inválido"),
  block: z.string().trim().regex(/^\d{2}$/, "Quadra deve ter 2 dígitos"),
  lot: z.string().trim().regex(/^\d{1,3}$/, "Lote inválido"),
  house: z.string().trim().regex(/^\d{1,3}$/, "Casa inválida"),
  neighborhood: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().length(2),
  cep: cepSchema,
});

export const EVENT_ADDRESS = eventAddressSchema.parse(rawEventAddress);

/** "Qd 01 · Lt 35 · Casa 33" — formato canônico para exibição. */
export const formatLotLine = (
  a: typeof EVENT_ADDRESS = EVENT_ADDRESS,
): string => `Qd ${a.block} · Lt ${a.lot} · Casa ${a.house}`;

/** "Av. João Leite, 1031 · Qd 01 · Lt 35 · Casa 33" */
export const formatStreetLine = (
  a: typeof EVENT_ADDRESS = EVENT_ADDRESS,
): string => `${a.street}, ${a.number} · ${formatLotLine(a)}`;

/** "Santa Genoveva · Goiânia — GO" */
export const formatLocalityLine = (
  a: typeof EVENT_ADDRESS = EVENT_ADDRESS,
): string => `${a.neighborhood} · ${a.city} — ${a.state}`;

/** "CEP 74672-020" */
export const formatCepLine = (
  a: typeof EVENT_ADDRESS = EVENT_ADDRESS,
): string => `CEP ${a.cep}`;

/** Endereço completo em uma única linha — útil para QR Code, metadados. */
export const formatFullAddress = (
  a: typeof EVENT_ADDRESS = EVENT_ADDRESS,
): string =>
  `${a.venue} - ${a.street}, ${a.number}, ${formatLotLine(a)}, ${a.neighborhood}, ${a.city}/${a.state} - CEP ${a.cep}`;

/** URL do Google Maps com o endereço já codificado. */
export const googleMapsUrl = (
  a: typeof EVENT_ADDRESS = EVENT_ADDRESS,
): string => {
  const query = encodeURIComponent(
    `${a.street}, ${a.number}, ${a.neighborhood}, ${a.city} - ${a.state}, ${a.cep}`,
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};
