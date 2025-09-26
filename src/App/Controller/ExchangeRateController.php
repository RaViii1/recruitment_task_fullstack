<?php

declare(strict_types=1);

namespace App\Controller;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpFoundation\Request;

class ExchangeRateController extends AbstractController
{
    private const CURRENCIES = ['EUR', 'USD', 'CZK', 'IDR', 'BRL'];

    private Client $httpClient;
    private LoggerInterface $logger;

    public function __construct(LoggerInterface $logger)
    {
        $this->httpClient = new Client([
            'timeout' => 5.0,
            'headers' => [
                'Accept' => 'application/json',
                'User-Agent' => 'TeleMedi/1.0',
            ],
        ]);
        $this->logger = $logger;
    }

    #[Route('/api/exchange-rates', name: 'api_exchange_rates', methods: ['GET'])]
    public function getExchangeRates(): JsonResponse
    {
        try {
            $response = $this->httpClient->request('GET', 'https://api.nbp.pl/api/exchangerates/tables/A/?format=json');
            $body = $response->getBody()->getContents();

            $this->logger->info('NBP API response: ' . $body);

            $data = json_decode($body, true);

            if (empty($data) || !isset($data[0]['rates'])) {
                $this->logger->error('Brak danych w odpowiedzi NBP');
                return $this->json(['error' => 'Brak danych z NBP'], 500);
            }

            $ratesTable = $data[0]['rates'];
            $midRates = [];

            foreach ($ratesTable as $rate) {
                if (in_array($rate['code'], self::CURRENCIES, true)) {
                    $midRates[$rate['code']] = $rate['mid'];
                }
            }

            $result = [];
            foreach (self::CURRENCIES as $code) {
                if (isset($midRates[$code])) {
                    $mid = $midRates[$code];
                    if ($code === 'EUR' || $code === 'USD') {
                        $buy = round($mid - 0.15, 4);
                        $sell = round($mid + 0.11, 4);
                    } else {
                        $buy = null;
                        $sell = round($mid + 0.2, 4);
                    }

                    $result[$code] = [
                        'mid' => $mid,
                        'buy' => $buy,
                        'sell' => $sell,
                    ];
                }
            }

            return $this->json($result);

        } catch (RequestException $e) {
            $errorMessage = 'Błąd HTTP: ';
            if ($e->hasResponse()) {
                $res = $e->getResponse();
                $status = $res->getStatusCode();
                $reason = $res->getReasonPhrase();
                $body = $res->getBody()->getContents();
                $errorMessage .= "$status $reason";
                $this->logger->error("Guzzle HTTP error $status $reason: $body");
                return $this->json(['error' => $errorMessage, 'details' => $body], 500);
            }
            $errorMessage .= $e->getMessage();
            $this->logger->error("Guzzle Request error: " . $e->getMessage());
            return $this->json(['error' => $errorMessage], 500);
        } catch (\Exception $e) {
            $this->logger->error('Nieznany błąd: ' . $e->getMessage());
            return $this->json(['error' => 'Nieznany błąd: ' . $e->getMessage()], 500);
        }
    }

    #[Route('/api/exchange-rates/yesterday', name: 'api_exchange_rates_yesterday', methods: ['GET'])]
    public function getYesterdayRates(): JsonResponse
    {
        try {
           
            $yesterday = new \DateTime('yesterday');
            $dateStr = $yesterday->format('Y-m-d');

            $url = sprintf('https://api.nbp.pl/api/exchangerates/tables/A/%s/?format=json', $dateStr);
            $response = $this->httpClient->request('GET', $url);
            $body = $response->getBody()->getContents();

            $this->logger->info('NBP rates for yesterday response: ' . $body);

            $data = json_decode($body, true);

            if (empty($data) || !isset($data[0]['rates']) || !is_array($data[0]['rates'])) {
                $this->logger->error('Brak danych lub niepoprawny format odpowiedzi NBP dla dnia: ' . $dateStr);
                return $this->json(['error' => 'Brak danych z NBP lub niepoprawny format'], 500);
            }

            $ratesTable = $data[0]['rates'];
            $result = [];

            foreach ($ratesTable as $rate) {
                if (in_array($rate['code'], self::CURRENCIES, true)) {
                    $mid = $rate['mid'];
                    if ($rate['code'] === 'EUR' || $rate['code'] === 'USD') {
                        $buy = round($mid - 0.15, 4);
                        $sell = round($mid + 0.11, 4);
                    } else {
                        $buy = null;
                        $sell = round($mid + 0.2, 4);
                    }

                    $result[$rate['code']] = [
                        'mid' => $mid,
                        'buy' => $buy,
                        'sell' => $sell,
                    ];
                }
            }

            return $this->json($result);

        } catch (RequestException $e) {
            return $this->handleRequestException($e);
        } catch (\Exception $e) {
            $this->logger->error('Nieznany błąd: ' . $e->getMessage());
            return $this->json(['error' => 'Nieznany błąd: ' . $e->getMessage()], 500);
        }
    }

    #[Route('/api/exchange-rates/history', name: 'api_exchange_rates_history', methods: ['GET'])]
    public function getHistoryRates(Request $request): JsonResponse
    {
        try {
            $dateStr = $request->query->get('date', (new \DateTime())->format('Y-m-d'));
            $endDate = new \DateTime($dateStr);
            
            $result = [];
            
            foreach (self::CURRENCIES as $currency) {
                $result[$currency] = [];
            }

            $daysBackLimit = 30;
            $currentDate = clone $endDate;
            $oneDay = new \DateInterval('P1D');

            while ($daysBackLimit > 0) {
                $dateFormatted = $currentDate->format('Y-m-d');
                
                $url = sprintf('https://api.nbp.pl/api/exchangerates/tables/c/%s/?format=json', $dateFormatted);
                try {
                    $response = $this->httpClient->request('GET', $url);
                    $body = $response->getBody()->getContents();
                    $data = json_decode($body, true);

                    if (!empty($data) && isset($data[0]['rates'])) {
                        foreach (self::CURRENCIES as $currency) {

                            // Jeżeli jeszcze nie mamy 14 zapisów dla tej waluty
                            if (count($result[$currency]) < 14) {
                                $currencyRate = array_filter($data[0]['rates'], fn($rate) => $rate['code'] === $currency);
                                if (!empty($currencyRate)) {
                                    $rate = array_values($currencyRate)[0];
                                    $buy = $rate['bid'] ?? null;
                                    $sell = $rate['ask'] ?? null;

                                    $result[$currency][] = [
                                        'date' => $dateFormatted,
                                        'buy' => $buy !== null ? round($buy, 4) : null,
                                        'sell' => $sell !== null ? round($sell, 4) : null,
                                    ];
                                }
                            }
                        }
                    }
                } catch (\Exception $e) {
                    
                }
                $currentDate->sub($oneDay);
                $daysBackLimit--;

                
                $allFilled = true;
                foreach (self::CURRENCIES as $currency) {
                    if (count($result[$currency]) < 14) {
                        $allFilled = false;
                        break;
                    }
                }
                if ($allFilled) {
                    break;
                }
            }

            foreach (self::CURRENCIES as $currency) {
                $result[$currency] = array_reverse($result[$currency]);
            }

            return $this->json($result);
        } catch (\Exception $e) {
            $this->logger->error('Błąd pobierania historii kursów: ' . $e->getMessage());
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }


}
    