# Sample non-interactive Armstrong generator for debugging the visualizer

def armstrong_generator(n=10):
    armstrong_list = []
    for nums in range(1, 1000):
        if len(armstrong_list) == n:
            return armstrong_list
        if len(str(nums)) > 1:
            val = 0
            for char in str(nums):
                val += int(char) ** len(str(nums))
            if val == nums:
                armstrong_list.append(val)
        else:
            val = nums ** 1
            if val == nums:
                armstrong_list.append(val)
    return armstrong_list

if __name__ == '__main__':
    # hard-coded number to avoid input() blocking while debugging
    print('Generating...')
    res = armstrong_generator(10)
    print(res)
