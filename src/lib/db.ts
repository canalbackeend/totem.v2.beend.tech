import Dexie, { type Table } from 'dexie';

export interface OfflineCampaign {
  id: string;
  name: string;
  questions: any[];
  status: string;
  responses_count?: number;
}

export interface OfflineTerminal {
  id: string;
  name: string;
  user_id: string;
  campaigns: string;
  email: string;
  company_name?: string;
  logo_url?: string;
}

export interface OfflineResponse {
  id?: number;
  campaign_id: string;
  terminal_id: string;
  answers: any[];
  created_at: string;
  synced: number; // 0 or 1
}

export class MyDatabase extends Dexie {
  campaigns!: Table<OfflineCampaign>;
  terminal!: Table<OfflineTerminal>;
  responses!: Table<OfflineResponse>;

  constructor() {
    super('SurveyOfflineDB');
    this.version(1).stores({
      campaigns: 'id, name',
      terminal: 'id',
      responses: '++id, campaign_id, synced'
    });
  }
}

export const db = new MyDatabase();
