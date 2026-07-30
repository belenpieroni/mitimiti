import AppNavigator from './app/navigation/AppNavigator';
import { ViviendaProvider } from './app/context/ViviendaContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <ViviendaProvider>
        <AppNavigator />
      </ViviendaProvider>
    </SafeAreaProvider>
  );
}