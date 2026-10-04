import { HostedProvider } from "./hostedProvider";
import type { AIProvider } from "./provider";

export const ai: AIProvider = new HostedProvider();