import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import '../../css/KantorRates.css';

const CURRENCIES = ['EUR', 'USD', 'CZK', 'IDR', 'BRL'];

function KantorRates() {
  const [rates, setRates] = useState({});
  const [previousRates, setPreviousRates] = useState({});
  const [loadingRates, setLoadingRates] = useState(false);
  const [loadingPreviousRates, setLoadingPreviousRates] = useState(false);
  const [errorRates, setErrorRates] = useState(null);

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [historyPrices, setHistoryPrices] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorHistory, setErrorHistory] = useState(null);

  useEffect(() => {
    async function fetchRates() {
      setLoadingRates(true);
      setLoadingPreviousRates(true);
      setErrorRates(null);

      try {
        const [currentResponse, previousResponse] = await axios.all([
          axios.get('/api/exchange-rates'),
          axios.get('/api/exchange-rates/yesterday'),
        ]);
        setRates(currentResponse.data);
        setPreviousRates(previousResponse.data);
      } catch (error) {
        setErrorRates('Błąd w pobieraniu kursów');
      } finally {
        setLoadingRates(false);
        setLoadingPreviousRates(false);
      }
    }

    fetchRates();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    setErrorHistory(null);
    try {
      const endDate = selectedDate;
      const startDateObj = new Date(selectedDate);
      startDateObj.setDate(startDateObj.getDate() - 13);
      const startDate = startDateObj.toISOString().slice(0, 10);
      const params = new URLSearchParams({ startDate, endDate });
      const response = await axios.get(`/api/exchange-rates/history?${params.toString()}`);

      if (response.data.history && response.data.history.length > 0) {
        const lastDayRates = response.data.history[response.data.history.length - 1].rates;
        setHistoryPrices(lastDayRates);
      } else {
        setHistoryPrices({});
      }
    } catch {
      setErrorHistory('Błąd w pobieraniu historii kursów');
      setHistoryPrices({});
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedDate]);

  return (
    <div className="kantor-container">
      <div className="kantor-header">
        <h2 className="kantor-title">Kursy walut kantoru</h2>
        <div className="kantor-subtitle">Aktualne kursy wymiany walut</div>
      </div>

      {(loadingRates || loadingPreviousRates) && (
        <div className="kantor-loading">
          <div className="loading-spinner"></div>
          <span>Ładowanie kursów...</span>
        </div>
      )}

      {errorRates && <div className="kantor-error">{errorRates}</div>}

      {!loadingRates && !errorRates && (
        <div className="kantor-content">
          <div className="kantor-table-wrapper">
            <table className="kantor-table">
              <thead>
                <tr>
                  <th>Waluta</th>
                  <th>Kupno (PLN)</th>
                  <th>Sprzedaż (PLN)</th>
                  <th>Cena ({selectedDate}) (PLN)</th>
                  <th>Historia</th>
                </tr>
              </thead>
              <tbody>
                {CURRENCIES.map((code) => (
                  <tr key={code} className="kantor-row">
                    <td className="currency-code">
                      <span className="currency-flag">{code}</span>
                    </td>
                    <td className="rate-buy">{rates[code]?.buy != null ? rates[code].buy.toFixed(4) : '-'}</td>
                    <td className="rate-sell">{rates[code]?.sell != null ? rates[code].sell.toFixed(4) : '-'}</td>
                    <td className="rate-historical">
                      {loadingPreviousRates ? (
                        <span className="loading-text">Ładowanie...</span>
                      ) : previousRates[code]?.mid !== undefined ? (
                        previousRates[code].mid.toFixed(4)
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="history-link">
                      <Link to={`/currency-history/${code}`} className="kantor-link">
                        Zobacz historię
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default KantorRates;
