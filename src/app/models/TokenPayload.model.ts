export interface TokenPayload {
  sub: number; // oppure restaurateurId, sub, ecc.
  email?: string;
  exp?: number;
  [key: string]: any;
}