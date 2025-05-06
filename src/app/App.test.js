import { expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import App from './App.svelte';

test('renders without crashing', () => {
  const { getByText } = render(App);
  expect(getByText('flash.comma.ai')).toBeInTheDocument();
});
