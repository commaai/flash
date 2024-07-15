import '@testing-library/jest-dom'
import MockWorker from './mockWorker';

global.Worker = MockWorker
