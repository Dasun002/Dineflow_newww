// Staff Table Management – Create, read, edit, and safe-delete restaurant tables
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Screen, Button, Card, Field, Label, H, Muted, Row, Chip, Empty, Callout, Stat } from '../../components/UI';
import { colors } from '../../theme';
import { useTables, useReservations, useQueue } from '../../hooks';
import { createTable, updateTable, checkTableSafeToDelete, deleteTable } from '../../services/db';
import { friendlyErr, todayStr } from '../../utils';
import { Ionicons } from '@expo/vector-icons';

const COMMON_AREAS = ['Main Dining Hall', 'Patio Section', 'Bar Area', 'Private Dining'];
const COMMON_CAPACITIES = ['2', '4', '6', '8'];

export default function TableManagement({ navigation }) {
  const tables = useTables();
  const reservations = useReservations();
  const queue = useQueue();

  const [selectedArea, setSelectedArea] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form fields
  const [tableName, setTableName] = useState('');
  const [tableArea, setTableArea] = useState('Main Dining Hall');
  const [tableCapacity, setTableCapacity] = useState('4');
  const [tableStatus, setTableStatus] = useState('available');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const areas = ['All', ...new Set(tables.map((t) => t.area).filter(Boolean))];
  const filteredTables = tables.filter((t) => selectedArea === 'All' || t.area === selectedArea);

  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const availableCount = tables.filter((t) => t.status === 'available').length;

  const openNewTableForm = () => {
    setEditingId(null);
    setTableName('');
    setTableArea('Main Dining Hall');
    setTableCapacity('4');
    setTableStatus('available');
    setFormError(null);
    setShowForm(true);
  };

  const openEditTableForm = (t) => {
    setEditingId(t.id);
    setTableName(t.name);
    setTableArea(t.area);
    setTableCapacity(String(t.capacity));
    setTableStatus(t.status || 'available');
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    const cleanName = tableName.trim();
    const cleanArea = tableArea.trim();
    const cap = parseInt(tableCapacity, 10);

    if (!cleanName) {
      setFormError('Table name is required (e.g. T10).');
      return;
    }
    if (!cleanArea) {
      setFormError('Section / Area is required.');
      return;
    }
    if (isNaN(cap) || cap < 1) {
      setFormError('Capacity must be a positive integer (at least 1 seat).');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (editingId) {
        await updateTable(editingId, {
          name: cleanName,
          area: cleanArea,
          capacity: cap,
          status: tableStatus,
        });
        setSuccessMsg(`Table "${cleanName}" updated successfully.`);
      } else {
        await createTable({
          name: cleanName,
          area: cleanArea,
          capacity: cap,
          status: tableStatus,
        });
        setSuccessMsg(`Table "${cleanName}" created successfully.`);
      }

      setShowForm(false);
      setEditingId(null);
      setTableName('');
      setTableCapacity('4');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (e) {
      setFormError(friendlyErr(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t) => {
    // Perform safety check first
    try {
      const check = await checkTableSafeToDelete(t.id);
      if (!check.safe) {
        Alert.alert('Deletion Blocked', check.reason);
        return;
      }

      // Safe to delete - prompt confirmation
      Alert.alert(
        'Delete Table',
        `Are you sure you want to permanently delete Table "${t.name}" (${t.area}, ${t.capacity} seats)?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteTable(t.id);
                setSuccessMsg(`Table "${t.name}" deleted.`);
                setTimeout(() => setSuccessMsg(null), 3500);
              } catch (e) {
                Alert.alert('Delete Failed', friendlyErr(e));
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Error', friendlyErr(e));
    }
  };

  return (
    <Screen
      staff
      title="Table Management"
      subtitle="Floor layout, seating capacity & table setup"
      onBack={() => navigation.goBack()}
      right={<Chip label="STAFF PORTAL" tone="ink" />}
    >
      {/* Top summary stats */}
      <Row>
        <Stat label="Total Tables" value={tables.length} />
        <Stat label="Available" value={availableCount} tone="green" />
        <Stat label="Occupied" value={occupiedCount} tone="red" />
      </Row>

      {/* Action / Add button */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <Label>Restaurant Tables ({filteredTables.length})</Label>
        {!showForm ? (
          <TouchableOpacity
            onPress={openNewTableForm}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.ink, borderRadius: 12 }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>Add Table</Text>
          </TouchableOpacity>
        ) : null}
      </Row>

      {successMsg ? (
        <Callout icon="checkmark-circle" tone="green" title="Success" text={successMsg} />
      ) : null}

      {/* Add / Edit Form Card */}
      {showForm ? (
        <Card style={{ borderColor: colors.ink, borderWidth: 2, gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H>{editingId ? `Edit Table ${tableName}` : 'Create New Table'}</H>
            <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.sub} />
            </TouchableOpacity>
          </Row>

          <Field
            label="Table Name / Identifier *"
            placeholder="e.g. T10, Booth 4, Patio 2"
            value={tableName}
            onChangeText={(v) => { setTableName(v); setFormError(null); }}
            autoCapitalize="characters"
          />

          <View style={{ gap: 6 }}>
            <Label>Section / Area *</Label>
            <Row style={{ flexWrap: 'wrap', gap: 6 }}>
              {COMMON_AREAS.map((a) => (
                <TouchableOpacity
                  key={a}
                  onPress={() => setTableArea(a)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: tableArea === a ? colors.ink : '#fff',
                    borderWidth: 1.5,
                    borderColor: tableArea === a ? colors.ink : colors.line,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: tableArea === a ? '#fff' : colors.ink }}>{a}</Text>
                </TouchableOpacity>
              ))}
            </Row>
            <Field
              placeholder="Or enter custom area name"
              value={tableArea}
              onChangeText={(v) => { setTableArea(v); setFormError(null); }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Label>Seating Capacity (Pax) *</Label>
            <Row style={{ gap: 8 }}>
              {COMMON_CAPACITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setTableCapacity(c)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: 10,
                    backgroundColor: tableCapacity === c ? colors.accent : '#fff',
                    borderWidth: 1.5,
                    borderColor: tableCapacity === c ? colors.accent : colors.line,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: tableCapacity === c ? '#fff' : colors.ink }}>{c} Seats</Text>
                </TouchableOpacity>
              ))}
            </Row>
            <Field
              placeholder="Custom capacity number"
              keyboardType="number-pad"
              value={tableCapacity}
              onChangeText={(v) => { setTableCapacity(v); setFormError(null); }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Label>Initial Status</Label>
            <Row style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => setTableStatus('available')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderRadius: 10,
                  backgroundColor: tableStatus === 'available' ? colors.green : '#fff',
                  borderWidth: 1.5,
                  borderColor: tableStatus === 'available' ? colors.green : colors.line,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: tableStatus === 'available' ? '#fff' : colors.green }}>Available</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTableStatus('occupied')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderRadius: 10,
                  backgroundColor: tableStatus === 'occupied' ? colors.red : '#fff',
                  borderWidth: 1.5,
                  borderColor: tableStatus === 'occupied' ? colors.red : colors.line,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: tableStatus === 'occupied' ? '#fff' : colors.red }}>Occupied</Text>
              </TouchableOpacity>
            </Row>
          </View>

          {formError ? (
            <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600' }}>{formError}</Text>
          ) : null}

          <Row style={{ marginTop: 4 }}>
            <Button
              title="Cancel"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => { setShowForm(false); setFormError(null); }}
            />
            <Button
              title={editingId ? 'Save Changes' : 'Create Table'}
              variant="primary"
              loading={submitting}
              style={{ flex: 1.2 }}
              onPress={handleSave}
            />
          </Row>
        </Card>
      ) : null}

      {/* Area filter tabs */}
      {areas.length > 1 ? (
        <Row style={{ flexWrap: 'wrap', gap: 6 }}>
          {areas.map((a) => (
            <TouchableOpacity
              key={a}
              onPress={() => setSelectedArea(a)}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 5,
                borderRadius: 14,
                backgroundColor: selectedArea === a ? colors.ink : '#fff',
                borderWidth: 1,
                borderColor: selectedArea === a ? colors.ink : colors.line,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: selectedArea === a ? '#fff' : colors.ink }}>
                {a}
              </Text>
            </TouchableOpacity>
          ))}
        </Row>
      ) : null}

      {/* Table list */}
      {filteredTables.length === 0 ? (
        <Card>
          <Empty icon="grid-outline" text="No tables found in this section. Tap 'Add Table' to set up a new table." />
        </Card>
      ) : (
        filteredTables.map((t) => (
          <Card key={t.id}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }}>{t.name}</Text>
                  <Chip
                    label={t.status === 'occupied' ? 'OCCUPIED' : 'AVAILABLE'}
                    tone={t.status === 'occupied' ? 'red' : 'green'}
                  />
                </Row>
                <Muted>{t.area} · {t.capacity} Seats / Pax</Muted>
              </View>

              <Row style={{ gap: 6 }}>
                <TouchableOpacity
                  onPress={() => openEditTableForm(t)}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
                  hitSlop={5}
                >
                  <Ionicons name="pencil" size={17} color={colors.ink} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDelete(t)}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.redSoft, borderWidth: 1, borderColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' }}
                  hitSlop={5}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.red} />
                </TouchableOpacity>
              </Row>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
