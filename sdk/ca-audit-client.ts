/**
 * CA Audit Desk API Client SDK
 * Ready-to-use client library for integrating CA Audit Intelligence
 * into any JavaScript or TypeScript application (Node.js, React, Vue, React Native, etc.)
 */

export interface CaAuditClientConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  email: string | null;
  financialYearsAudited?: number;
  documentChunks?: number;
  hasDocuments?: boolean;
}

export interface FinancialRecord {
  year: number;
  income: number | null;
  profit: number | null;
  loss: number | null;
}

export interface ChatResult {
  success: boolean;
  reply: string;
  isMeetingAction: boolean;
  client?: ClientRecord;
  citations?: string[];
  financials?: FinancialRecord[];
  error?: string;
}

export interface MeetingResult {
  success: boolean;
  eventId?: string;
  htmlLink: string;
  calendarWebUrl?: string;
  meetLink: string;
  attendees?: string[];
  error?: string;
}

export class CaAuditClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: CaAuditClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers);

    if (this.apiKey) {
      headers.set("X-API-Key", this.apiKey);
    }
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMessage = (data as any)?.error || (data as any)?.message || `HTTP ${res.status}: ${res.statusText}`;
      throw new Error(errMessage);
    }

    return data as T;
  }

  /** Check API health and service status */
  async health(): Promise<any> {
    return this.request("/api/health");
  }

  /** Get API discovery metadata and active environment */
  async discovery(): Promise<any> {
    return this.request("/api");
  }

  /** List all audit clients */
  async getClients(stats = true): Promise<ClientRecord[]> {
    const res = await this.request<{ clients: ClientRecord[] }>(`/api/clients?stats=${stats}`);
    return res.clients || [];
  }

  /** Register a new client */
  async createClient(name: string, email?: string): Promise<ClientRecord> {
    const res = await this.request<{ client: ClientRecord }>("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    return res.client;
  }

  /** Get single client profile and statistics */
  async getClient(id: string): Promise<any> {
    return this.request(`/api/clients/${id}`);
  }

  /** Delete a client and their audit records */
  async deleteClient(id: string): Promise<any> {
    return this.request(`/api/clients/${id}`, { method: "DELETE" });
  }

  /**
   * Ask the CA Audit Chatbot a question or request a meeting
   */
  async chat(params: {
    message: string;
    clientId?: string;
    clientName?: string;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
  }): Promise<ChatResult> {
    return this.request<ChatResult>("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  /** Fetch 10-year financials for a client */
  async getFinancials(params: {
    clientId?: string;
    clientName?: string;
    order?: "asc" | "desc";
  }): Promise<{ financials: FinancialRecord[]; metrics: any }> {
    const query = new URLSearchParams();
    if (params.clientId) query.set("clientId", params.clientId);
    if (params.clientName) query.set("clientName", params.clientName);
    if (params.order) query.set("order", params.order);
    return this.request(`/api/financials?${query.toString()}`);
  }

  /** Upsert financial year records programmatically */
  async saveFinancials(params: {
    clientId?: string;
    clientName?: string;
    records: FinancialRecord[];
  }): Promise<any> {
    return this.request("/api/financials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  /** Ingest document text or rows directly via JSON */
  async ingestData(params: {
    clientId?: string;
    clientName?: string;
    text?: string;
    fileName?: string;
    rows?: FinancialRecord[];
  }): Promise<any> {
    return this.request("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  /** Schedule or reschedule a Google Meet consultation */
  async scheduleMeeting(params: {
    topic: string;
    start: string; // YYYY-MM-DDTHH:mm:ss
    durationMinutes?: number;
    attendees: string[];
    action?: "create" | "update";
    eventId?: string;
  }): Promise<MeetingResult> {
    return this.request<MeetingResult>("/api/calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  /** Send calendar invitation email */
  async sendMeetingEmail(params: {
    topic: string;
    start: string;
    durationMinutes?: number;
    meetLink: string;
    attendees: string[];
  }): Promise<any> {
    return this.request("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }
}

export default CaAuditClient;
