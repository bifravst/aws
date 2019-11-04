@Only
Feature: Cell Geolocation

    GPS fixes will be stored with the cell id
    so that the UI can show an approximate tracker location
    based on the cell id even if a device has no current GPS fix

    Background:

        Given I am run after the "Connect a Cat Tracker" feature
        And I am run after the "Device: Update Shadow" feature

    Scenario: Device has a shadow
        Given the cat tracker is connected
        Then the cat tracker updates its reported state with
            """
            {
                "bat": {
                    "v": 3781,
                    "ts": 1567942204010
                }
            }
            """

    Scenario: Device enters a cell

        Given the cat tracker is connected
        Then the cat tracker updates its reported state with
            """
            {
                "roam": {
                    "v": {
                        "rsrp": 0,
                        "area": 211,
                        "mccmnc": 26201,
                        "cell": 29071842,
                        "ip": "10.202.80.9"
                    },
                    "ts": 1572340608948
                }
            }
            """

    Scenario: Device acquires a GPS fix

        Given the cat tracker is connected
        Then the cat tracker updates its reported state with
            """
            {
                "gps": {
                    "v": {
                        "lng": 7.676834,
                        "lat": 47.809966,
                        "acc": 18.625809,
                        "alt": 443.635193,
                        "spd": 0.448984,
                        "hdg": 0
                    },
                    "ts": 1572340324000
                }
            }
            """

    Scenario: User can resolve the cell

        Given I am authenticated with Cognito
        When I execute "getItem" of the AWS DynamoDB SDK with
            """
            {
                "TableName": "{cellGeoLocationsCacheTable}",
                "Key": {
                    "cellId": {
                        "S": "29071842-26201-211"
                    }
                },
                "ProjectionExpression": "lat,lng"
            }
            """
        Then "awsSdk.res.Item" should equal this JSON
            """
            {
                "lat": {
                    "N": "47.809966"
                },
                "lng": {
                    "N": "7.676834"
                }
            }
            """