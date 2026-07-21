import AppNavigator from './app/navigation/AppNavigator';
import { ViviendaProvider } from './app/context/ViviendaContext';

export default function App() {
  return (
    <ViviendaProvider>
      <AppNavigator />
    </ViviendaProvider>
  );
}