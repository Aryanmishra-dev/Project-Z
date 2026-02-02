import { create } from 'zustand';

import type { QuizSessionWithDetails, Question } from '@/types';

interface QuizState {
  currentSession: QuizSessionWithDetails | null;
  currentQuestionIndex: number;
  answers: Record<string, number>; // questionId -> selectedOptionIndex
  markedForReview: Set<string>;
  timeRemaining: number | null;
  isSubmitting: boolean;
}

interface QuizActions {
  startQuiz: (session: QuizSessionWithDetails) => void;
  setAnswer: (questionId: string, optionIndex: number) => void;
  toggleMarkForReview: (questionId: string) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  setTimeRemaining: (seconds: number) => void;
  decrementTime: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
  clearQuiz: () => void;
}

export type QuizStore = QuizState & QuizActions;

const initialState: QuizState = {
  currentSession: null,
  currentQuestionIndex: 0,
  answers: {},
  markedForReview: new Set(),
  timeRemaining: null,
  isSubmitting: false,
};

export const useQuizStore = create<QuizStore>((set, get) => ({
  ...initialState,

  startQuiz: (session) =>
    set({
      currentSession: session,
      currentQuestionIndex: 0,
      answers: {},
      markedForReview: new Set(),
      timeRemaining: null,
      isSubmitting: false,
    }),

  setAnswer: (questionId, optionIndex) =>
    set((state) => ({
      answers: { ...state.answers, [questionId]: optionIndex },
    })),

  toggleMarkForReview: (questionId) =>
    set((state) => {
      const newMarked = new Set(state.markedForReview);
      if (newMarked.has(questionId)) {
        newMarked.delete(questionId);
      } else {
        newMarked.add(questionId);
      }
      return { markedForReview: newMarked };
    }),

  goToQuestion: (index) => {
    const { currentSession } = get();
    if (currentSession && index >= 0 && index < currentSession.questions.length) {
      set({ currentQuestionIndex: index });
    }
  },

  nextQuestion: () => {
    const { currentSession, currentQuestionIndex } = get();
    if (currentSession && currentQuestionIndex < currentSession.questions.length - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },

  previousQuestion: () => {
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex > 0) {
      set({ currentQuestionIndex: currentQuestionIndex - 1 });
    }
  },

  setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),

  decrementTime: () =>
    set((state) => ({
      timeRemaining: state.timeRemaining !== null ? Math.max(0, state.timeRemaining - 1) : null,
    })),

  setSubmitting: (isSubmitting) => set({ isSubmitting }),

  clearQuiz: () => set(initialState),
}));

// Selectors
export const selectCurrentQuestion = (state: QuizStore): Question | null => {
  if (!state.currentSession?.questions) return null;
  return state.currentSession.questions[state.currentQuestionIndex] || null;
};

export const selectProgress = (state: QuizStore) => {
  if (!state.currentSession?.questions) {
    return { answered: 0, total: 0, percentage: 0 };
  }
  const total = state.currentSession.questions.length;
  const answered = Object.keys(state.answers).length;
  return {
    answered,
    total,
    percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
  };
};

export const selectIsLastQuestion = (state: QuizStore): boolean => {
  if (!state.currentSession?.questions) return true;
  return state.currentQuestionIndex === state.currentSession.questions.length - 1;
};

export const selectIsFirstQuestion = (state: QuizStore): boolean => {
  return state.currentQuestionIndex === 0;
};
