import { forwardRef } from 'react';
import Input from './Input.jsx';

// Native date picker. Values are 'YYYY-MM-DD' strings. Supports min / max.
const DateInput = forwardRef(function DateInput(props, ref) {
  return <Input ref={ref} type="date" {...props} />;
});

export default DateInput;
