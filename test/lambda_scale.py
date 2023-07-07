import time
from concurrent.futures import ThreadPoolExecutor
import boto3

# function name
FUNCTION_NAME = "HelloFabbiLambda"

# lambda client
lambda_client = boto3.client("lambda")

# number of concurrent request
NUM_CONCUR_REQUEST = 100


def invoke_lambda(id: int) -> str:
    """
    invoke lambda
    """
    res = lambda_client.invoke(
        FunctionName=FUNCTION_NAME
    )

    print(f'lamda {id} {res["Payload"].read()}')
    print("\n")
    return res['Payload'].read()


def test_scale_lambda() -> None:
    """
    Test how lambda scale
    """
    with ThreadPoolExecutor(max_workers=NUM_CONCUR_REQUEST) as executor:
        for k in range(1, NUM_CONCUR_REQUEST):
            executor.submit(invoke_lambda, k)


if __name__ == "__main__":
    while True:
        test_scale_lambda()
        time.sleep(5)