
var app = new Vue({
    el: '#app',
    data: {
        market: {},
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
            date: null,
            fromType: 'USD',
            toType: 'BTC'
        },
        moment: moment
    },
    methods: {
        addCurrency: () => {
            if (app.currencies.indexOf(app.selected) === -1) {
                app.currencies.push(app.selected);
                app.getCurrentPrices();
                app.updateData();
                app.selected = '';
            }
        },
        removeCurrency: (currency) => {
            var idx = app.currencies.indexOf(currency);
            app.currencies.splice(idx, 1);
            delete app.market[currency];
            app.updateData();
        },
        addTransaction: (transaction) => {
            transaction.fromAmount = parseFloat(transaction.fromAmount);
            transaction.toAmount = parseFloat(transaction.toAmount);
            transaction.roi = parseFloat(0);
            transaction.roiPercentage = parseFloat(0);
            app.transactions.unshift(transaction);
            app.getROI(transaction);
            app.newTransaction = {
                date: null,
                fromType: 'USD',
                toType: 'BTC'
            };
            app.updateData();
        },
        cancelNewTransaction: () => {
            app.newTransaction = {
                date: null,
                fromType: 'USD',
                toType: 'BTC'
            };
        },
        removeTransaction: (idx) => {
            app.transactions.splice(idx, 1);
            getROIs();
            app.updateData();
        },
        updateTransaction: (transaction) => {
            app.selectedTransaction = null;
            getROIs();
            app.updateData();
        },
        updateData: () => {
            app.sortTransactions();
            var data = JSON.stringify({
                transactions: app.transactions,
                currencies: app.currencies
            });
            fetch("/update", {
                method: "POST",
                body: data
            });
        },
        sortTransactions: () => {
            app.transactions.sort((a, b) => {
                return new Date(a.date) - new Date(b.date);
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
            return parseFloat(total);
        },
        getROI: (transaction) => {
            var fromValue, toValue;
            if (transaction.fromType === 'USD') {
                app.totalInvested += parseFloat(transaction.fromAmount);
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
                            transaction.roiPercentage = ((toValue - fromValue) / fromValue) * 100;
                            app.totalROI += transaction.roi;
                        });
                });
        },
        getFilteredTransactions: () => {
            if (app) {
                return app.transactions.filter(function (transaction) {
                    return (transaction.fromType === app.filterCurrency || transaction.toType === app.filterCurrency || app.filterCurrency === '');
                });
            }
        },
        getCurrentPrices: () => {
            for (var i = 0; i < app.currencies.length; i++) {
                getPrice();
                function getPrice() {
                    var currency = app.currencies[i];
                    fetch('https://min-api.cryptocompare.com/data/pricemultifull?&fsyms=' + currency + '&tsyms=USD')
                        .then(response => response.json())
                        .then(json => {
                            app.$set(app.market, currency, json.RAW[currency].USD);
                        });
                }
            }
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
                app.sortTransactions();                
                getTransactedCurrencies();
                getROIs();
                setInterval(getROIs, 120000);
                app.currencies = json.currencies;
                app.getCurrentPrices();
                setInterval(app.getCurrentPrices, 60000);
            });
        fetch('https://min-api.cryptocompare.com/data/all/coinlist')
            .then(response => response.json())
            .then(json => {
                app.allCoins = json.Data;
            });
    }
});

function getROIs() {
    app.totalInvested = 0;
    app.totalROI = 0;
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

