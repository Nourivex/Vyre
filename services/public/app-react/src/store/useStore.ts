import { create } from "zustand";
import { Agent, Conversation } from "../types/api";

type State = {
  agents: Agent[];
  conversations: Conversation[];
  selectedAgentId?: string;
  ollamaStatus?: string;
  setAgents: (a: Agent[]) => void;
  setConversations: (c: Conversation[]) => void;
  setSelectedAgent: (id?: string) => void;
};

export const useStore = create<State>((set) => ({
  agents: [],
  conversations: [],
  selectedAgentId: undefined,
  ollamaStatus: undefined,
  setAgents: (a) => set({ agents: a }),
  setConversations: (c) => set({ conversations: c }),
  setSelectedAgent: (id) => set({ selectedAgentId: id }),
}));

export default useStore;
