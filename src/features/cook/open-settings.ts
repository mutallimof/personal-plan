import { useNavigate } from "@tanstack/react-router";

/** Opens Settings on the AI page (the Cook sheet closes because the address changes). */
export function useOpenAiSettings() {
  const navigate = useNavigate();
  return () => void navigate({ to: "/pantry", search: { sheet: "settings", section: "ai" } });
}
