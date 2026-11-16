import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { COLORS, SPACING } from '../theme/theme';
import { aiApi } from '../utils/api';

export default function AICoachScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('workout'); // 'workout' | 'diet' | 'coach'
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Hey there! I am your LockIn AI accountability coach. Ask me anything about your training, diet, or recovery, and let\'s optimize your routines.',
    }
  ]);
  const [aiTyping, setAiTyping] = useState(false);

  // Dynamic state for plans
  const [workoutPlan, setWorkoutPlan] = useState(null);
  const [dietPlan, setDietPlan] = useState(null);
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  const [loadingDiet, setLoadingDiet] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const scrollViewRef = useRef(null);

  const loadWorkoutPlan = async (regenerate = false) => {
    setLoadingWorkout(true);
    setErrorMsg(null);
    const res = await aiApi.getWorkoutPlan(regenerate);
    setLoadingWorkout(false);
    if (res.success && res.data) {
      setWorkoutPlan(res.data.workoutPlan || null);
    } else {
      setErrorMsg(res.message || 'Failed to load workout plan.');
    }
  };

  const loadDietPlan = async (regenerate = false) => {
    setLoadingDiet(true);
    setErrorMsg(null);
    const res = await aiApi.getDietPlan(regenerate);
    setLoadingDiet(false);
    if (res.success && res.data) {
      setDietPlan(res.data.dietPlan || null);
    } else {
      setErrorMsg(res.message || 'Failed to load diet plan.');
    }
  };

  useEffect(() => {
    if (activeTab === 'workout' && !workoutPlan) {
      loadWorkoutPlan();
    } else if (activeTab === 'diet' && !dietPlan) {
      loadDietPlan();
    }
  }, [activeTab]);

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage = { sender: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    const query = chatInput;
    setChatInput('');
    setAiTyping(true);

    const res = await aiApi.chat(query, chatMessages);
    setAiTyping(false);

    if (res.success && res.data?.response) {
      setChatMessages(prev => [...prev, { sender: 'ai', text: res.data.response }]);
    } else {
      setChatMessages(prev => [...prev, { 
        sender: 'ai', 
        text: 'Sorry, I am having trouble connecting to the accountability network right now. Stick to your goals and keep checking in!' 
      }]);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>AI Coach</Text>
        <Text style={styles.subtitle}>Personalized fitness strategies powered by GPT-4o.</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'workout' && styles.tabActive]}
          onPress={() => setActiveTab('workout')}
        >
          <Text style={[styles.tabText, activeTab === 'workout' && styles.tabTextActive]}>Workout</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'diet' && styles.tabActive]}
          onPress={() => setActiveTab('diet')}
        >
          <Text style={[styles.tabText, activeTab === 'diet' && styles.tabTextActive]}>Diet Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'coach' && styles.tabActive]}
          onPress={() => setActiveTab('coach')}
        >
          <Text style={[styles.tabText, activeTab === 'coach' && styles.tabTextActive]}>Ask Coach</Text>
        </TouchableOpacity>
      </View>

      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Content */}
      {activeTab === 'workout' && (
        <View style={styles.tabContentContainer}>
          {loadingWorkout ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Structuring your workout plan...</Text>
            </View>
          ) : (
            <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {workoutPlan ? (
                <View>
                  <View style={styles.card}>
                    <Text style={styles.cardHeader}>{workoutPlan.title.toUpperCase()}</Text>
                    <Text style={styles.cardSub}>
                      Tailored for {workoutPlan.fitnessLevel?.toUpperCase()} • Focus: {workoutPlan.goals?.join(', ').toUpperCase()}
                    </Text>
                    <Text style={styles.cardDescription}>{workoutPlan.description}</Text>
                    
                    <View style={styles.divider} />
                    
                    {workoutPlan.schedule?.map((day, idx) => (
                      <View key={idx} style={styles.daySection}>
                        <Text style={styles.dayHeader}>
                          {day.day}: {day.focus} {day.isRestDay ? '💤' : '💪'}
                        </Text>
                        {day.isRestDay ? (
                          <Text style={styles.restDayText}>Rest Day. Let your muscles recover and stay hydrated.</Text>
                        ) : (
                          day.exercises?.map((ex, exIdx) => (
                            <View key={exIdx} style={styles.exerciseRow}>
                              <Text style={styles.exerciseName}>• {ex.name}</Text>
                              <Text style={styles.exerciseDetail}>
                                {ex.sets} sets x {ex.reps} reps (⏱️ Rest: {ex.restSeconds}s)
                              </Text>
                              {ex.notes ? <Text style={styles.exerciseNotes}>Note: {ex.notes}</Text> : null}
                            </View>
                          ))
                        )}
                      </View>
                    ))}
                  </View>
                  
                  <TouchableOpacity style={styles.regenerateBtn} onPress={() => loadWorkoutPlan(true)}>
                    <Text style={styles.regenerateBtnText}>↻ REGENERATE WORKOUT PLAN</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No active workout plan found.</Text>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => loadWorkoutPlan(true)}>
                    <Text style={styles.actionBtnText}>Generate Custom Workout Plan</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {activeTab === 'diet' && (
        <View style={styles.tabContentContainer}>
          {loadingDiet ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Structuring your nutrition plan...</Text>
            </View>
          ) : (
            <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {dietPlan ? (
                <View>
                  <View style={styles.card}>
                    <Text style={styles.cardHeader}>{dietPlan.title.toUpperCase()}</Text>
                    <Text style={styles.cardSub}>
                      Diet Type: {dietPlan.dietType?.toUpperCase()} • Caloric Target: {dietPlan.dailyCalories} kcal
                    </Text>
                    
                    <View style={styles.macroContainer}>
                      <View style={styles.macroBox}>
                        <Text style={[styles.macroValue, { color: COLORS.primary }]}>
                          {dietPlan.macros?.protein}g
                        </Text>
                        <Text style={styles.macroLabel}>Protein</Text>
                      </View>
                      <View style={styles.macroBox}>
                        <Text style={[styles.macroValue, { color: COLORS.secondary }]}>
                          {dietPlan.macros?.carbs}g
                        </Text>
                        <Text style={styles.macroLabel}>Carbs</Text>
                      </View>
                      <View style={styles.macroBox}>
                        <Text style={[styles.macroValue, { color: COLORS.accent }]}>
                          {dietPlan.macros?.fats}g
                        </Text>
                        <Text style={styles.macroLabel}>Fats</Text>
                      </View>
                    </View>

                    <View style={styles.divider} />
                    
                    {dietPlan.meals?.map((meal, idx) => (
                      <View key={idx} style={styles.mealSection}>
                        <View style={styles.mealHeaderRow}>
                          <Text style={styles.mealHeader}>
                            {meal.name} {meal.time ? `(${meal.time})` : ''}
                          </Text>
                          <Text style={styles.mealMacros}>
                            {meal.totalCalories} kcal | {meal.totalProtein}g P
                          </Text>
                        </View>
                        {meal.foods?.map((food, fIdx) => (
                          <Text key={fIdx} style={styles.mealDesc}>
                            • {food.item} ({food.quantity}) — {food.calories} kcal | {food.protein}g P
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                  
                  <TouchableOpacity style={styles.regenerateBtn} onPress={() => loadDietPlan(true)}>
                    <Text style={styles.regenerateBtnText}>↻ REGENERATE DIET PLAN</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No active diet plan found.</Text>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => loadDietPlan(true)}>
                    <Text style={styles.actionBtnText}>Generate Custom Diet Plan</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {activeTab === 'coach' && (
        <View style={styles.chatContainer}>
          <ScrollView 
            style={styles.chatScroll} 
            contentContainerStyle={styles.chatScrollContent}
            ref={scrollViewRef}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {chatMessages.map((msg, index) => (
              <View 
                key={index} 
                style={[
                  styles.msgBubble,
                  msg.sender === 'ai' ? styles.msgAi : styles.msgUser
                ]}
              >
                <Text style={styles.msgText}>{msg.text}</Text>
              </View>
            ))}
            {aiTyping && (
              <View style={[styles.msgBubble, styles.msgAi]}>
                <ActivityIndicator color={COLORS.primary} size="small" />
              </View>
            )}
          </ScrollView>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask anything (e.g. what should I eat post-workout?)"
              placeholderTextColor={COLORS.textMuted}
              value={chatInput}
              onChangeText={setChatInput}
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSendChat}>
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  backLink: {
    marginBottom: SPACING.sm,
  },
  backLinkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: SPACING.xs,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  tab: {
    paddingVertical: SPACING.md,
    marginRight: SPACING.lg,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
  },
  cardHeader: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardSub: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  cardDescription: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  daySection: {
    marginBottom: SPACING.md,
  },
  dayHeader: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: SPACING.xs,
  },
  restDayText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    marginLeft: SPACING.sm,
  },
  exerciseRow: {
    marginBottom: 8,
    marginLeft: SPACING.sm,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  exerciseDetail: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
    marginLeft: 10,
  },
  exerciseNotes: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginLeft: 10,
    marginTop: 1,
  },
  macroContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: SPACING.md,
  },
  macroBox: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    width: '28%',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  macroLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  mealSection: {
    marginBottom: SPACING.md,
  },
  mealHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealHeader: {
    color: COLORS.secondary,
    fontWeight: '800',
    fontSize: 15,
  },
  mealMacros: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  mealDesc: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: SPACING.sm,
    marginTop: 2,
  },
  regenerateBtn: {
    marginTop: SPACING.lg,
    borderColor: COLORS.border,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  regenerateBtnText: {
    color: COLORS.secondary,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  actionBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 10,
  },
  actionBtnText: {
    color: COLORS.text,
    fontWeight: '800',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: SPACING.sm,
  },
  errorBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: 8,
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  errorText: {
    color: COLORS.accent,
    fontSize: 13,
    textAlign: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  chatScroll: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  chatScrollContent: {
    paddingVertical: SPACING.md,
  },
  msgBubble: {
    borderRadius: 12,
    padding: SPACING.md,
    maxWidth: '85%',
    marginBottom: SPACING.md,
  },
  msgAi: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  msgUser: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
  },
  msgText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  sendText: {
    color: COLORS.text,
    fontWeight: '700',
  },
});
