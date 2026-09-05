import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import type { CashFlow, Forecast } from '../domain/analytics';
import { formatMoney, fractionDigits } from '../domain/values';
export function CashFlowChart({ flows, currency }: { flows: CashFlow[]; currency: string }) {
  const divisor = 10 ** fractionDigits(currency);
  return (
    <div
      className="chart"
      role="img"
      aria-label="Monthly income and expense chart. Exact values are available in Reports."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={flows.map((flow) => ({
            ...flow,
            income: flow.income / divisor,
            expenses: flow.expenses / divisor,
          }))}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickLine={false} />
          <YAxis width={62} tickLine={false} />
          <Tooltip
            formatter={(value) => formatMoney(Math.round(Number(value) * divisor), currency)}
          />
          <Legend />
          <Bar dataKey="income" name="Income" fill="#24796a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#adc0d5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ForecastChart({
  points,
  currency,
}: {
  points: Forecast['points'];
  currency: string;
}) {
  const divisor = 10 ** fractionDigits(currency);
  return (
    <div
      className="chart"
      role="img"
      aria-label="Forecast savings range. Exact values are in the table below."
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points.map((point) => ({
            ...point,
            expected: point.expected / divisor,
            lower: point.lower / divisor,
            upper: point.upper / divisor,
          }))}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" />
          <YAxis width={65} />
          <Tooltip
            formatter={(value) => formatMoney(Math.round(Number(value) * divisor), currency)}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="upper"
            name="Upper estimate"
            stroke="#8c9db4"
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey="expected"
            name="Expected savings"
            stroke="#24796a"
            strokeWidth={3}
          />
          <Line
            type="monotone"
            dataKey="lower"
            name="Lower estimate"
            stroke="#8c9db4"
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
