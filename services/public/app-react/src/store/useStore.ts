import { create } from "zustand";
import { Agent, Conversation } from "../types/api";

type State = {
  agents: Agent[];
  conversations: Conversation[];
  selectedAgentId?: string;
  selectedConversationId?: string;
  ollamaStatus?: string;
  page: 'chat' | 'collections';
  isSettingsOpen: boolean;
  setAgents: (a: Agent[]) => void;
  setConversations: (c: Conversation[]) => void;
  setSelectedAgent: (id?: string) => void;
  setSelectedConversation: (id?: string) => void;
  setPage: (p: 'chat'|'collections') => void;
  setIsSettingsOpen: (v: boolean) => void;
  setOllamaStatus: (s?: string) => void;
};

export const useStore = create<State>((set) => ({
  agents: [],
  conversations: [],
  selectedAgentId: undefined,
  selectedConversationId: undefined,
  ollamaStatus: undefined,
  page: 'chat',
  isSettingsOpen: false,
  setAgents: (a) => set({ agents: a }),
  setConversations: (c) => set({ conversations: c }),
  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  setSelectedConversation: (id) => set({ selectedConversationId: id }),
  setPage: (p) => set({ page: p }),
  setIsSettingsOpen: (v) => set({ isSettingsOpen: v }),
  setOllamaStatus: (s) => set({ ollamaStatus: s }),
}));

export default useStore;
