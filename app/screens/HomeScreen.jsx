import { View, Text } from 'react-native';
import { colors } from '../theme/colors';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Text>Home</Text>
    </View>
  );
}