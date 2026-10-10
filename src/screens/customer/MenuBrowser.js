// Customer Menu Browser – Browse active restaurant dishes with search and category filters
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Screen, Button, Card, Field, Label, H, Muted, Row, Chip, Empty, Hero } from '../../components/UI';
import { colors } from '../../theme';
import { useMenu } from '../../hooks';
import { Ionicons } from '@expo/vector-icons';

const MENU_CATEGORIES = ['All', 'Appetizers', 'Mains', 'Desserts', 'Beverages', 'Specials'];

export default function MenuBrowser({ navigation }) {
  const allItems = useMenu();
  const [selectedCat, setSelectedCat] = useState('All');
  const [search, setSearch] = useState('');

  // Customer filter: only show items that are NOT archived and are in stock / available
  const availableItems = allItems.filter((i) => !i.isArchived && i.isAvailable !== false);

  const filtered = availableItems.filter((item) => {
    const matchCat = selectedCat === 'All' || item.category === selectedCat;
    const matchSearch =
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <Screen
      title="Restaurant Menu"
      subtitle="Harbor Bistro · Chef's Curated Selection"
      onBack={() => navigation.goBack()}
    >
      {/* Hero header */}
      <Hero
        title="Culinary Excellence"
        subtitle="Seasonal ingredients & coastal-inspired craft dishes"
        chip="HARBOR BISTRO"
        height={130}
      />

      {/* Search Input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#fff',
          borderRadius: 14,
          paddingHorizontal: 12,
          borderWidth: 1.5,
          borderColor: colors.line,
          gap: 8,
          height: 48,
        }}
      >
        <Ionicons name="search-outline" size={18} color={colors.sub} />
        <TextInput
          placeholder="Search dishes, ingredients..."
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1, fontSize: 15, color: colors.ink }}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.sub} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category selector chips */}
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {MENU_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setSelectedCat(cat)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
              backgroundColor: selectedCat === cat ? colors.accent : '#fff',
              borderWidth: 1,
              borderColor: selectedCat === cat ? colors.accent : colors.line,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: selectedCat === cat ? '#fff' : colors.ink }}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </Row>

      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Label>{selectedCat} ({filtered.length})</Label>
        <Muted>{availableItems.length} total available items</Muted>
      </Row>

      {/* Dishes List */}
      {filtered.length === 0 ? (
        <Card>
          <Empty
            icon="restaurant-outline"
            text={
              search
                ? `No dishes found matching "${search}".`
                : 'No available items in this category today. Please check back soon!'
            }
          />
        </Card>
      ) : (
        filtered.map((item) => (
          <Card key={item.id} style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Row>
                  <Chip label={item.category.toUpperCase()} tone="gray" />
                  <Chip label="AVAILABLE" tone="green" />
                </Row>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>{item.name}</Text>
              </View>
              <Text style={{ fontSize: 19, fontWeight: '900', color: colors.accent, marginLeft: 8 }}>
                ${Number(item.price).toFixed(2)}
              </Text>
            </Row>

            {item.description ? (
              <Text style={{ fontSize: 13, color: colors.sub, lineHeight: 18 }}>{item.description}</Text>
            ) : null}
          </Card>
        ))
      )}

      {/* Quick Booking CTA card */}
      <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent, gap: 10, marginTop: 8 }}>
        <H style={{ color: colors.accent }}>Ready to Dine With Us?</H>
        <Muted style={{ color: colors.ink }}>
          Book your table in advance or join our live virtual queue right now.
        </Muted>
        <Row>
          <Button
            style={{ flex: 1 }}
            title="Reserve Table"
            variant="accent"
            onPress={() => navigation.navigate('ReservationDetails')}
          />
          <Button
            style={{ flex: 1 }}
            title="Join Queue"
            variant="primary"
            onPress={() => navigation.navigate('JoinQueue')}
          />
        </Row>
      </Card>
    </Screen>
  );
}
