import React, { useRef, useState } from 'react';
import { View, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Dimensions, NativeScrollEvent, NativeSyntheticEvent, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, HOUSES_LIST, HOUSES, HouseId, ABILITIES } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { HouseCharacter } from '../src/components/HouseCharacter';
import { useGame } from '../src/contexts/GameContext';
import { sfx } from '../src/utils/audio';

const { width: SW } = Dimensions.get('window');
const CARD_W = Math.min(SW - 48, 340);

export default function CharacterCreateScreen() {
  const { createCharacter } = useGame();
  const [houseIdx, setHouseIdx] = useState(0);
  const [name, setName] = useState('Spark');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / CARD_W);
    if (idx !== houseIdx && idx >= 0 && idx < HOUSES_LIST.length) {
      sfx.click();
      setHouseIdx(idx);
    }
  };

  const goTo = (idx: number) => {
    sfx.click();
    setHouseIdx(idx);
    scrollRef.current?.scrollTo({ x: idx * CARD_W, animated: true });
  };

  const start = async () => {
    setLoading(true);
    setError('');
    try {
      sfx.confirm();
      await createCharacter(name.trim() || 'Spark', HOUSES_LIST[houseIdx].id);
      router.replace('/game');
    } catch (e: any) {
      setError(e.message || 'Failed to create character');
      sfx.cancel();
    } finally {
      setLoading(false);
    }
  };

  const house = HOUSES_LIST[houseIdx];
  const sigAbility = ABILITIES[house.signatureAbility];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: house.bgColor }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.outer} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <PixelText size={9} color={COLORS.neonGreen}>{'> SELECT_PROTOTYPE_'}</PixelText>
            <PixelText size={22} color={house.color} glow bold style={{ marginTop: 4 }}>
              CHOOSE YOUR HOUSE
            </PixelText>
            <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 4 }}>
              SWIPE OR TAP TO CYCLE · {houseIdx + 1} / {HOUSES_LIST.length}
            </PixelText>
          </View>

          {/* Carousel */}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W}
            decelerationRate="fast"
            onMomentumScrollEnd={onScroll}
            contentContainerStyle={{ paddingHorizontal: (SW - CARD_W) / 2 }}
          >
            {HOUSES_LIST.map((h, i) => (
              <View key={h.id} style={[styles.card, { width: CARD_W, borderColor: h.color, backgroundColor: h.bgColor }]} testID={`house-card-${h.id}`}>
                <View style={[styles.cardHeader, { borderBottomColor: h.color }]}>
                  <PixelText size={16} color={h.color} glow bold style={{ textAlign: 'center' }}>
                    {h.name.toUpperCase()}
                  </PixelText>
                  <PixelText size={10} color={COLORS.textDim} style={{ textAlign: 'center', marginTop: 2 }}>
                    — {h.title.toUpperCase()} —
                  </PixelText>
                </View>
                <View style={styles.charWrap}>
                  <HouseCharacter index={i} width={170} height={240} glow={i === houseIdx} />
                </View>
                <View style={[styles.traitBox, { borderColor: h.color }]}>
                  <PixelText size={9} color={h.color} bold>TRAIT</PixelText>
                  <PixelText size={10} color={COLORS.text} style={{ marginTop: 2 }}>{h.trait}</PixelText>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Dots */}
          <View style={styles.dots}>
            {HOUSES_LIST.map((h, i) => (
              <TouchableOpacity
                key={h.id}
                onPress={() => goTo(i)}
                testID={`dot-${h.id}`}
                style={[styles.dot, { backgroundColor: i === houseIdx ? h.color : COLORS.border, width: i === houseIdx ? 24 : 10 }]}
              />
            ))}
          </View>

          {/* Details */}
          <View style={[styles.details, { borderColor: house.color }]}>
            <PixelText size={11} color={house.color} bold>{house.ability}</PixelText>
            <PixelText size={10} color={COLORS.textDim} style={{ marginTop: 4, lineHeight: 14 }}>
              {house.description}
            </PixelText>
            <View style={styles.statRow}>
              <Stat label="HP" value={house.stats.hp} color={COLORS.hp} />
              <Stat label="MP" value={house.stats.mp} color={COLORS.mp} />
              <Stat label="ATK" value={house.stats.atk} color={COLORS.neonRed} />
              <Stat label="DEF" value={house.stats.def} color={COLORS.neonCyan} />
              <Stat label="SPD" value={house.stats.spd} color={COLORS.neonYellow} />
            </View>
            <View style={[styles.sigBox, { borderColor: house.color }]}>
              <PixelText size={9} color={COLORS.neonYellow} bold>SIGNATURE</PixelText>
              <PixelText size={11} color={house.color} bold style={{ marginTop: 2 }}>
                ◆ {sigAbility?.name?.toUpperCase()}
              </PixelText>
              <PixelText size={9} color={COLORS.text} style={{ marginTop: 2 }}>
                {sigAbility?.desc}
              </PixelText>
            </View>
          </View>

          {/* Name input */}
          <View style={styles.field}>
            <PixelText size={10} color={COLORS.textDim}>YOUR NAME, CADET</PixelText>
            <TextInput
              style={[styles.input, { borderColor: house.color, color: house.color }]}
              value={name}
              onChangeText={setName}
              maxLength={20}
              placeholder="Spark"
              placeholderTextColor={COLORS.textDim}
              testID="char-name"
            />
          </View>

          {error ? <PixelText size={11} color={COLORS.neonRed} style={{ marginTop: 4, textAlign: 'center' }}>! {error}</PixelText> : null}

          <View style={{ marginTop: 18, gap: 10 }}>
            <PixelButton
              title={loading ? 'IGNITING…' : `CHOOSE ${house.name.split(' ')[1].toUpperCase()}`}
              onPress={start}
              disabled={loading || !name.trim()}
              color={house.color}
              size="lg"
              full
              testID="char-create-submit"
            />
            <PixelButton title="◀ BACK" onPress={() => router.back()} color={COLORS.textDim} full />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <PixelText size={9} color={COLORS.textDim}>{label}</PixelText>
      <PixelText size={13} color={color} bold>{value}</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  outer: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 12 },
  card: {
    borderWidth: 2,
    marginHorizontal: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  cardHeader: { borderBottomWidth: 2, paddingBottom: 8, width: '100%', alignItems: 'center' },
  charWrap: { marginVertical: 14, alignItems: 'center' },
  traitBox: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'stretch' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14, marginBottom: 8 },
  dot: { height: 6, borderRadius: 3 },
  details: {
    borderWidth: 2, padding: 14,
    backgroundColor: 'rgba(10,10,20,0.5)',
    marginTop: 8,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  stat: { alignItems: 'center', flex: 1 },
  sigBox: { borderWidth: 1, padding: 10, marginTop: 12 },
  field: { marginTop: 16 },
  input: {
    marginTop: 6,
    backgroundColor: 'rgba(10,10,20,0.6)',
    borderWidth: 2,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 20, letterSpacing: 2, textAlign: 'center',
  },
});
