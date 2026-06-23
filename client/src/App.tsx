import { ErrorBoundary } from "./components/ErrorBoundary/ErrorBoundary";
import { HomePage } from "./pages/HomePage";

export function App() {
  return (
    <ErrorBoundary>
      <HomePage />
    </ErrorBoundary>
  );
}
