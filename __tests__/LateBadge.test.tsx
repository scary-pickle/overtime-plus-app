import React from 'react';
import { render, act } from '@testing-library/react-native';
import { LateBadge } from '../components/LateBadge';
import { getCurrentTime } from '../lib/time';

jest.mock('../lib/time', () => {
  const actual = jest.requireActual('../lib/time');
  return {
    ...actual,
    getCurrentTime: jest.fn(),
  };
});

const mockGetCurrentTime = getCurrentTime as jest.Mock;

describe('LateBadge', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('does not show late for an overnight shift before it starts', () => {
    jest.setSystemTime(new Date(2025, 10, 26, 20, 7, 0));
    mockGetCurrentTime.mockReturnValue('20:07');

    const { queryByText } = render(
      <LateBadge rosteredStart="23:00" rosteredFinish="08:00" />
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(queryByText(/\+.*late/i)).toBeNull();
  });

  it('shows late after a daytime shift has finished when not logged', () => {
    jest.setSystemTime(new Date(2025, 10, 26, 18, 15, 0));
    mockGetCurrentTime.mockReturnValue('18:15');

    const { getByText } = render(
      <LateBadge rosteredStart="09:00" rosteredFinish="17:00" />
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });

    getByText('+1h 15m late');
  });
});
