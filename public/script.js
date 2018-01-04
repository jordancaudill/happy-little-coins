var exchangeList = [
    'Poloniex',
    'Bitstamp',
    'CoinBase',
    'HitBTC'
];

var app = new Vue({
    el: '#app',
    data: {
        market: [],
        transactions: [],
        allCoins: {},
        currencies: [],
        selected: '',
        filterCurrency: '',
        currentTab: 'transactions',
        transactedCurrencies: [],
        totalInvested: 0,
        totalROI: 0,
        selectedTransaction: -1,
        newTransaction: {
            date: null
        },
        moment: moment
    },
    methods: {
        addCurrency: () => {
            if (app.currencies.indexOf(app.selected) === -1) {
                app.currencies.push(app.selected);
                socket.emit('SubAdd', {
                    subs: ['2~' + exchangeList[0] + '~' + app.selected + '~USD']
                });
                app.updateData();
                app.selected = '';
            }
        },
        removeCurrency: (currency) => {
            var idx = app.currencies.indexOf(currency);
            app.currencies.splice(idx, 1);
            for (var i = 0; i < app.market.length; i++) {
                if (app.market[i].type === currency) {
                    app.market.splice(i, 1);
                    break;
                }
            }
            app.updateData();
        },
        addTransaction: (transaction) => {
            app.transactions.push(transaction);
            app.newTransaction = {
                date: null
            };
            app.updateData();
        },
        removeTransaction: (idx) => {
            app.transactions.splice(idx, 1);
            app.updateData();
        },
        updateTransaction: (transaction) => {
            app.selectedTransaction = null;
            app.getROI(transaction);
            app.updateData();
        },
        updateData: () => {
            var data = JSON.stringify({
                transactions: app.transactions,
                currencies: app.currencies
            });
            fetch("/update", {
                method: "POST",
                body: data
            });
        },
        getMyCurrency: (type) => {
            var total = 0;
            for (var i = 0; i < app.transactions.length; i++) {
                if (app.transactions[i].toType === type) {
                    total += app.transactions[i].toAmount;
                }
                if (app.transactions[i].fromType === type) {
                    total -= app.transactions[i].fromAmount;
                }
            }
            return total;
        },
        getPercentDiff: (days, type, exchange) => {
            fetch('https://min-api.cryptocompare.com/data/dayAvg?e=' + exchange + '&fsym=' + type + '&tsym=USD&toTs=' + (moment().unix() - (60 * 60 * 24 * days)))
                .then(response => response.json())
                .then(json => {
                    for (var i = 0; i < app.market.length; i++) {
                        if (app.market[i].type === type) {
                            app.market[i]['diff' + days] = app.market[i].currentPrice / json.USD;
                            break;
                        }
                    }
                });
        },
        getROI: (transaction) => {
            var fromValue, toValue;
            if (transaction.fromType === 'USD') {
                app.totalInvested += transaction.fromAmount;
            }
            fetch('https://min-api.cryptocompare.com/data/price?&fsym=' + transaction.fromType + '&tsyms=USD')
                .then(response => response.json())
                .then(json => {
                    fromValue = json.USD * transaction.fromAmount;
                    fetch('https://min-api.cryptocompare.com/data/price?&fsym=' + transaction.toType + '&tsyms=USD')
                        .then(response => response.json())
                        .then(json => {
                            toValue = json.USD * transaction.toAmount;
                            transaction.roi = toValue - fromValue;
                            app.totalROI += transaction.roi;
                        });
                });
        },
        getFilteredTransactions: () => {
            if (app) {
                return app.sortedTransactions.filter(function (transaction) {
                    return (transaction.fromType === app.filterCurrency || transaction.toType === app.filterCurrency || app.filterCurrency === '');
                });
            }

        }

    },
    computed: {
        sortedTransactions: function () {
            app.transactions.sort((a, b) => {
                return !(new Date(a.date) - new Date(b.date));
            });
            return app.transactions;
        }

    },
    filters: {
        commas: function (value, float) {
            if (!value) return '0.00';
            if (float) {
                var decimals = parseFloat(value).toString().split('.')[1];
                var numbers = parseInt(value).toLocaleString();
                if (decimals === undefined) {
                    decimals = '00';
                }
                return numbers + '.' + decimals;
            } else {
                var decimals = parseFloat(value).toFixed(2).split('.')[1];
                var numbers = parseInt(value).toLocaleString();
                if (value < 0 && value > -1) {
                    return '-' + numbers + '.' + decimals;
                } else {
                    return numbers + '.' + decimals;
                }
            }
        },
    },
    created() {
        fetch('data.json')
            .then(response => response.json())
            .then(json => {
                app.transactions = json.transactions;
                getTransactedCurrencies();
                setInterval(getROIs(), 120000);
                app.currencies = json.currencies;
                var subs = [];
                for (var i = 0; i < app.currencies.length; i++) {
                    subs.push('2~' + exchangeList[0] + '~' + json.currencies[i] + '~USD');
                }
                socket.on('connect', function () {
                    for (var k = 0; k < subs.length; k++) {
                        function subscribe() {
                            var p = subs[k];
                            setTimeout(function () {
                                socket.emit('SubAdd', {
                                    subs: [p]
                                });
                            }, 600);
                        }
                        subscribe();
                    }
                });
            });
        fetch('https://min-api.cryptocompare.com/data/all/coinlist')
            .then(response => response.json())
            .then(json => {
                app.allCoins = json.Data;
            });
    }
});

function getROIs() {
    for (var i = 0; i < app.transactions.length; i++) {
        app.getROI(app.transactions[i]);
    }
}
function getTransactedCurrencies() {
    for (var i = 0; i < app.transactions.length; i++) {
        if (app.transactedCurrencies.indexOf(app.transactions[i].fromType) === -1) {
            app.transactedCurrencies.push(app.transactions[i].fromType);
        }
        if (app.transactedCurrencies.indexOf(app.transactions[i].toType) === -1) {
            app.transactedCurrencies.push(app.transactions[i].toType);
        }
    }
}

var socket = io('wss://streamer.cryptocompare.com', {
    transports: ['websocket']
});

socket.on('m', function (data) {
    var dataArray = data.split('~');
    if ((dataArray[0] === '1' || dataArray[0] === '2' || dataArray[0] === '4') && dataArray[4]) {
        var idx = -1;
        for (var i = 0; i < app.market.length; i++) {
            if (app.market[i].type === dataArray[2]) {
                idx = i;
                break;
            }
        }
        if (idx === -1) {
            var marketObj = {
                type: dataArray[2],
                diff1: 0,
                diff7: 0,
                diff30: 0,
                img: app.allCoins[dataArray[2]].ImageUrl
            };
        } else {
            var marketObj = app.market[i];
        }
        marketObj.exchange = dataArray[1];
        marketObj.currentPrice = dataArray[5];
        if (idx === -1) {
            app.market.push(marketObj)
        }
        console.log(dataArray)
        // get % differences for day, week, and month
        app.getPercentDiff(1, marketObj.type, marketObj.exchange);
        app.getPercentDiff(7, marketObj.type, marketObj.exchange);
        app.getPercentDiff(30, marketObj.type, marketObj.exchange);
    } else if (!dataArray[4] && data.indexOf('LOADCOMPLETE') === -1) {
        //try different exchange
        for (var i = 0; i < exchangeList.length; i++) {
            if (data.indexOf(exchangeList[i]) > -1) {
                if (exchangeList[i + 1]) {
                    socket.emit('SubAdd', {
                        subs: [data.replace(exchangeList[i], exchangeList[i + 1])]
                    });
                }
                break;
            }
        }

    }
});