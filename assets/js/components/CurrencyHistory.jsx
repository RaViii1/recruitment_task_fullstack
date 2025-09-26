import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import '../../css/CurrencyHistory.css';

function CurrencyHistory() {
  const { code } = useParams();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCurrencyHistory() {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get('/api/exchange-rates/history', {
          params: { date: selectedDate },
        });
        const data = response.data;

        if (!data || !data[code]) {
          setHistoryData([]);
          setError('Brak danych historycznych dla podanej waluty');
          setLoading(false);
          return;
        }

        const currencyHistory = data[code]
          .filter(entry => entry.date <= selectedDate)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 14);

        setHistoryData(currencyHistory);
      } catch (err) {
        setError('Błąd w pobieraniu historii kursów');
      }

      setLoading(false);
    }

    if (code) {
      fetchCurrencyHistory();
    }
  }, [code, selectedDate]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateChange = (current, previous) => {
    if (previous == null || current == null) return null;
    return ((current - previous) / previous) * 100;
  };

  // Renderowanie komponentu z date pickerem
  return (
    <div className="currency-history-container">
      <div className="currency-history-header">
        <Link to="/" className="back-link">← Powrót do kursów</Link>
        <h1 className="currency-history-title">Historia kursu {code}</h1>



        <p className="currency-history-subtitle">
          Kursy z ostatnich 14 dni przed {formatDate(selectedDate)}
        </p>
      </div>

      {loading && (
        <div className="currency-history-loading">
          <div className="loading-spinner"></div>
          <span>Ładowanie historii kursów...</span>
        </div>
      )}

      {error && <div className="currency-history-error">{error}</div>}

      {!loading && !error && historyData.length > 0 && (
        <div className="currency-history-content">
          <div className="currency-history-stats">
            <div className="stat-card">
              <div className="stat-label">Najwyższy kurs kupna</div>
              <div className="stat-value">{Math.max(...historyData.map(d => d.buy)).toFixed(4)} PLN</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Najniższy kurs kupna</div>
              <div className="stat-value">{Math.min(...historyData.map(d => d.buy)).toFixed(4)} PLN</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Średni kurs kupna</div>
              <div className="stat-value">{(historyData.reduce((sum, d) => sum + d.buy, 0) / historyData.length).toFixed(4)} PLN</div>
            </div>
          </div>
          <div className="date-picker-container">
            <label htmlFor="datePicker">Wybierz datę od której chcesz sprawdzić kurs (domyślnie dziś):</label>
            <p>Od wybranej daty pokazane jest ostatnie 14 dni bez weekendów</p>
            <input
              id="datePicker"
              type="date"
              value={selectedDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="currency-history-table-wrapper">
            <table className="currency-history-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Kupno (PLN)</th>
                  <th>Sprzedaż (PLN)</th>
                  <th>Zmiana kupna</th>
                  <th>Zmiana sprzedaży</th>
                </tr>
              </thead>
              <tbody>
                {historyData.map((day, index) => {
                  const previousDay = historyData[index + 1];
                  const buyChange = calculateChange(day.buy, previousDay?.buy);
                  const sellChange = calculateChange(day.sell, previousDay?.sell);

                  return (
                    <tr key={day.date} className="currency-history-row">
                      <td className="date-cell">{formatDate(day.date)}</td>
                      <td className="rate-buy">{day.buy.toFixed(4)}</td>
                      <td className="rate-sell">{day.sell.toFixed(4)}</td>
                      <td className={`change-cell ${buyChange > 0 ? 'positive' : buyChange < 0 ? 'negative' : 'neutral'}`}>
                        {buyChange !== null ? `${buyChange > 0 ? '+' : ''}${buyChange.toFixed(2)}%` : '-'}
                      </td>
                      <td className={`change-cell ${sellChange > 0 ? 'positive' : sellChange < 0 ? 'negative' : 'neutral'}`}>
                        {sellChange !== null ? `${sellChange > 0 ? '+' : ''}${sellChange.toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && historyData.length === 0 && (
        <div className="currency-history-empty">
          <p>Brak danych historycznych dla waluty {code}</p>
        </div>
      )}
    </div>
  );
}

export default CurrencyHistory;
