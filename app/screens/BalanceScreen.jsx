import { View, Text } from 'react-native';
import { colors } from '../theme/colors';

export default function BalanceScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Text>Balance</Text>
    </View>
  );
}