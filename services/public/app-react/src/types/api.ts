export type Agent = {
  id: string;
  name: string;
  description?: string;
};

export type Conversation = {
  id: string;
  title?: string;
  updated_at?: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  text: string;
  created_at?: string;
  role?: "user" | "assistant" | "system";
};

export type Collection = {
  id: string;
  name: string;
  description?: string;
  document_count: number;
  chunk_count: number;
  updated_at?: string;
};

export type Job = {
  job_id: string;
  type: 'ingest' | 'embed' | 'index' | string;
  status: 'queued' | 'running' | 'done' | 'error';
  payload: string;
  attempts: number;
  last_error?: string;
  created_at: string;
};
