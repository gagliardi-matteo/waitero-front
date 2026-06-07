export type TipoConnessione = 'TCP_IP' | 'USB' | 'BLUETOOTH';

export type ModelloStampante =
  | 'ITALRETAIL_PR2'
  | 'EPSON_TM_T20'
  | 'EPSON_TM_M30'
  | 'CUSTOM_KUBE'
  | 'GENERIC_ESC_POS';

export interface Stampante {
  id: number;
  ristoranteId: number;
  nome: string;
  modello: ModelloStampante;
  tipoConnessione: TipoConnessione;
  ipAddress: string | null;
  porta: number | null;
  abilitata: boolean;
  dataCreazione: string;
}

export interface StampantePayload {
  ristoranteId?: number | null;
  nome: string;
  modello: ModelloStampante;
  tipoConnessione: TipoConnessione;
  ipAddress: string | null;
  porta: number | null;
  abilitata: boolean;
}
