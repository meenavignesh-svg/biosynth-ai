export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string;
  timestamp: number;
}

export interface SequenceAnalysis {
  sequence: string;
  type: 'DNA' | 'RNA' | 'Protein';
  gcContent?: number;
  length: number;
  translation?: string;
  transcription?: string;
}
